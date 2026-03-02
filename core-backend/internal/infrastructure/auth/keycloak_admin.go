package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	adminToken     string
	adminTokenExp  time.Time
	adminTokenLock sync.Mutex
)

// GetAdminToken retrieves a cached admin token or fetches a new one
func GetAdminToken() (string, error) {
	adminTokenLock.Lock()
	defer adminTokenLock.Unlock()

	// Return cached token if still valid (with 30s buffer)
	if adminToken != "" && time.Now().Before(adminTokenExp.Add(-30*time.Second)) {
		return adminToken, nil
	}

	tokenURL := os.Getenv("KEYCLOAK_TOKEN_URL")
	if tokenURL == "" {
		tokenURL = "http://locallitix-keycloak:8080/realms/locallitix/protocol/openid-connect/token"
	}

	// Use master realm for admin access
	masterTokenURL := strings.Replace(tokenURL, "/realms/locallitix/", "/realms/master/", 1)

	adminUser := os.Getenv("KEYCLOAK_ADMIN_USER")
	adminPass := os.Getenv("KEYCLOAK_ADMIN_PASSWORD")
	if adminUser == "" {
		adminUser = "admin"
	}
	if adminPass == "" {
		adminPass = "admin"
	}

	formData := fmt.Sprintf(
		"grant_type=password&client_id=admin-cli&username=%s&password=%s",
		adminUser, adminPass,
	)

	resp, err := http.Post(masterTokenURL, "application/x-www-form-urlencoded", strings.NewReader(formData))
	if err != nil {
		return "", fmt.Errorf("failed to request admin token: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("keycloak admin auth failed (%d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}

	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse admin token response: %w", err)
	}

	adminToken = tokenResp.AccessToken
	adminTokenExp = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	log.Println("[IAM] Admin token acquired successfully")
	return adminToken, nil
}

// ExtractCookieClaims extracts JWT claims from the session_token cookie
func ExtractCookieClaims(r *http.Request) (jwt.MapClaims, error) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return nil, fmt.Errorf("no session cookie")
	}

	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	token, _, err := parser.ParseUnverified(cookie.Value, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims := token.Claims.(jwt.MapClaims)

	// Check expiry
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().Unix() > int64(exp) {
			return nil, fmt.Errorf("token expired")
		}
	}

	return claims, nil
}

// HasRole checks if the JWT claims contain a specific realm role
func HasRole(claims jwt.MapClaims, role string) bool {
	realmAccess, ok := claims["realm_access"].(map[string]interface{})
	if !ok {
		return false
	}

	roleList, ok := realmAccess["roles"].([]interface{})
	if !ok {
		return false
	}

	for _, r := range roleList {
		if fmt.Sprintf("%v", r) == role {
			return true
		}
	}

	return false
}

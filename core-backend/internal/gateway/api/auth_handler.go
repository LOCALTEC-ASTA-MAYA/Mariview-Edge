package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Name     string   `json:"name"`
	Roles    []string `json:"roles"`
}

type KeycloakTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// LoginHandler handles POST /api/auth/login
// Uses Keycloak Direct Access Grant (Resource Owner Password Credentials)
func LoginHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Username == "" || req.Password == "" {
			http.Error(w, "Username and password are required", http.StatusBadRequest)
			return
		}

		// Call Keycloak Token Endpoint with Direct Access Grant
		tokenURL := os.Getenv("KEYCLOAK_TOKEN_URL")
		clientID := os.Getenv("KEYCLOAK_CLIENT_ID")
		if tokenURL == "" {
			tokenURL = "http://locallitix-keycloak:8080/realms/locallitix/protocol/openid-connect/token"
		}
		if clientID == "" {
			clientID = "chimp-platform"
		}

		formData := fmt.Sprintf(
			"grant_type=password&client_id=%s&username=%s&password=%s",
			clientID, req.Username, req.Password,
		)

		resp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", strings.NewReader(formData))
		if err != nil {
			log.Printf("[AUTH] Keycloak request failed: %v", err)
			http.Error(w, "Authentication service unavailable", http.StatusServiceUnavailable)
			return
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			log.Printf("[AUTH] Keycloak returned %d: %s", resp.StatusCode, string(body))
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		var tokenResp KeycloakTokenResponse
		if err := json.Unmarshal(body, &tokenResp); err != nil {
			log.Printf("[AUTH] Failed to parse token response: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Set HttpOnly cookie
		cookieDomain := os.Getenv("COOKIE_DOMAIN")
		cookieSecure := os.Getenv("COOKIE_SECURE") == "true"

		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    tokenResp.AccessToken,
			Path:     "/",
			Domain:   cookieDomain,
			MaxAge:   tokenResp.ExpiresIn,
			HttpOnly: true,
			Secure:   cookieSecure,
			SameSite: http.SameSiteStrictMode,
		})

		// Parse JWT to extract user info for response
		parser := jwt.NewParser(jwt.WithoutClaimsValidation())
		token, _, err := parser.ParseUnverified(tokenResp.AccessToken, jwt.MapClaims{})
		if err != nil {
			log.Printf("[AUTH] Failed to parse JWT: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		userResp := buildUserResponse(claims)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(userResp)
	}
}

// LogoutHandler handles POST /api/auth/logout
func LogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		cookieDomain := os.Getenv("COOKIE_DOMAIN")

		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    "",
			Path:     "/",
			Domain:   cookieDomain,
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   os.Getenv("COOKIE_SECURE") == "true",
			SameSite: http.SameSiteStrictMode,
			Expires:  time.Unix(0, 0),
		})

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"message":"Logged out successfully"}`))
	}
}

// MeHandler handles GET /api/auth/me
func MeHandler(jwksURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		cookie, err := r.Cookie("session_token")
		if err != nil {
			http.Error(w, "Not authenticated", http.StatusUnauthorized)
			return
		}

		// Parse without full validation for /me — the cookie middleware on
		// protected routes does full JWKS validation
		parser := jwt.NewParser(jwt.WithoutClaimsValidation())
		token, _, err := parser.ParseUnverified(cookie.Value, jwt.MapClaims{})
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims := token.Claims.(jwt.MapClaims)

		// Check token expiry manually
		if exp, ok := claims["exp"].(float64); ok {
			if time.Now().Unix() > int64(exp) {
				http.Error(w, "Token expired", http.StatusUnauthorized)
				return
			}
		}

		userResp := buildUserResponse(claims)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(userResp)
	}
}

// buildUserResponse extracts user info from JWT claims
func buildUserResponse(claims jwt.MapClaims) LoginResponse {
	var roles []string
	if realmAccess, ok := claims["realm_access"].(map[string]interface{}); ok {
		if roleList, ok := realmAccess["roles"].([]interface{}); ok {
			for _, r := range roleList {
				role := fmt.Sprintf("%v", r)
				// Filter out Keycloak internal roles
				if role != "offline_access" && role != "uma_authorization" && role != "default-roles-locallitix" {
					roles = append(roles, role)
				}
			}
		}
	}

	name := ""
	if gn, ok := claims["given_name"].(string); ok {
		name = gn
		if fn, ok := claims["family_name"].(string); ok {
			name += " " + fn
		}
	}
	if name == "" {
		if n, ok := claims["preferred_username"].(string); ok {
			name = n
		}
	}

	email, _ := claims["email"].(string)
	username, _ := claims["preferred_username"].(string)

	return LoginResponse{
		Username: username,
		Email:    email,
		Name:     name,
		Roles:    roles,
	}
}

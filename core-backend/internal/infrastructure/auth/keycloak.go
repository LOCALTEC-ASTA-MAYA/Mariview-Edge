package auth

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

// KeycloakMiddleware validates JWT from Authorization header (for WebSocket/legacy)
func KeycloakMiddleware(jwksURL string) func(http.Handler) http.Handler {
	jwks := initJWKS(jwksURL)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			token, err := jwt.Parse(tokenString, jwks.Keyfunc)

			if err != nil || !token.Valid {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUser, token.Claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// CookieAuthMiddleware validates JWT from the session_token HttpOnly cookie
func CookieAuthMiddleware(jwksURL string) func(http.Handler) http.Handler {
	jwks := initJWKS(jwksURL)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("session_token")
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			token, err := jwt.Parse(cookie.Value, jwks.Keyfunc)
			if err != nil || !token.Valid {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUser, token.Claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type contextKey string

const ContextKeyUser contextKey = "user"

// initJWKS initializes the JWKS keyfunc with retry logic
func initJWKS(jwksURL string) *keyfunc.JWKS {
	var jwks *keyfunc.JWKS
	var err error

	for i := 0; i < 20; i++ {
		jwks, err = keyfunc.Get(jwksURL, keyfunc.Options{})
		if err == nil {
			log.Println("[IAM] Keycloak Security Gate is Ready!")
			return jwks
		}
		log.Printf("[IAM] Waiting for Keycloak to boot... (%d/20)", i+1)
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Fatalf("[IAM] Failed to connect to Keycloak: %v", err)
	}

	return jwks
}
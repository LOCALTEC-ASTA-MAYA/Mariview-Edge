import { createRoot } from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { AuthProvider } from "./contexts/AuthContext";
import client from "./lib/apollo-client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <ApolloProvider client={client}>
        <AuthProvider>
            <App />
        </AuthProvider>
    </ApolloProvider>
);

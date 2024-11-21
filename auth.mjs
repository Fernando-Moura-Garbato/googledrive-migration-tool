import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

//Configuração do MSAL
export const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: process.env.AUTHORITY,
        clientSecret: process.env.CLIENT_SECRET
    }
};

//ensureScope() - Função para admitir novas permissões, desnecessária ao momento
/*
function ensureScope (scope) {
    if (!msalRequest.scopes.some((s) => s.toLowerCase() === scope.toLowerCase())) {
        msalRequest.scopes.push(scope);
    }
}
*/

//Inicializa um cliente daemon do MSAL usando msalConfig
export const msalClient = new ConfidentialClientApplication(msalConfig);

//Com o cliente ativo, cria uma request pro Graph e adquire um token
export const daemonRequest = {
    scopes: ["https://graph.microsoft.com/.default"]
}

//Adquire o token
export async function getToken(){
    const tentToken = await msalClient.acquireTokenByClientCredential(daemonRequest)
    return tentToken;
}

// Middleware
export const authProvider = {
    getAccessToken: async () => {
        const tentToken = await getToken();
        return tentToken.accessToken;
    }
};

// Inicializa o cliente do graph com Middleware
export const graphClient = Client.initWithMiddleware({authProvider});
//É válido relembrar que as respostas do servidor geralmente são objetos preenchindos por diversos metadados.
//Para validar objetos e variáveis, é sempre bom logar.

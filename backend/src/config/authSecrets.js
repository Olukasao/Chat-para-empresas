const getJwtSecretFn = () => {
    const secret = String(process.env.JWT_SECRET || "");

    if (process.env.NODE_ENV === "production" && secret.length < 32) {
        throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres em producao.");
    }

    return secret || "development-only-jwt-secret-change-me";
};

export const getJwtSecret = getJwtSecretFn;


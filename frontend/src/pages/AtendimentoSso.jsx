import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";

const CLIENT_ID = "acessanet-atendimento";

const getSafeInternalRedirect = (location) => {
    const target = `${location.pathname}${location.search}`;
    return target.startsWith("/") && !target.startsWith("//") ? target : "/";
};

const buildCallbackUrl = (redirectUri, params) => {
    const callbackUrl = new URL(redirectUri);

    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            callbackUrl.searchParams.set(key, value);
        }
    });

    return callbackUrl.toString();
};

export default function AtendimentoSso() {
    const location = useLocation();
    const navigate = useNavigate();
    const ranRef = useRef(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;

        const params = new URLSearchParams(location.search);
        const clientId = params.get("client_id") || "";
        const redirectUri = params.get("redirect_uri") || "";
        const state = params.get("state") || "";
        const token = localStorage.getItem("token");

        const fail = (message, code = "access_denied") => {
            if (!redirectUri) {
                setError(message);
                return;
            }

            try {
                window.location.replace(buildCallbackUrl(redirectUri, {
                    error: code,
                    state,
                }));
            } catch {
                setError(message);
            }
        };

        if (clientId !== CLIENT_ID || !redirectUri || !state) {
            fail("Solicitação de login inválida.");
            return;
        }

        if (!token) {
            navigate(`/login?redirect=${encodeURIComponent(getSafeInternalRedirect(location))}`, {
                replace: true,
            });
            return;
        }

        async function authorize() {
            try {
                const { data } = await api.post(
                    "/integrations/atendimento/sso/code",
                    {
                        clientId,
                        redirectUri,
                        state,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    },
                );

                window.location.replace(buildCallbackUrl(redirectUri, {
                    code: data.code,
                    state: data.state || state,
                }));
            } catch (err) {
                console.error("Erro ao autorizar login do atendimento:", err);
                fail(err.response?.data?.error || "Não foi possível autorizar o atendimento.");
            }
        }

        void authorize();
    }, [location, navigate]);

    return (
        <main className="min-h-screen grid place-items-center bg-[#0A0F1C] px-6 text-white">
            <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827]/80 p-8 text-center shadow-2xl">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#0EA5E9]/15 text-[#38BDF8]">
                    {error ? <MessageCircle size={28} /> : <LoaderCircle size={28} className="animate-spin" />}
                </div>
                <h1 className="mb-2 text-2xl font-bold">Entrar no Atendimento</h1>
                {error ? (
                    <p className="text-sm text-red-200">{error}</p>
                ) : (
                    <p className="text-sm text-gray-300">Autorizando com sua sessão do chat interno...</p>
                )}
            </section>
        </main>
    );
}

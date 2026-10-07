import { useState, useEffect } from "react";
import api from "../services/api";
import { socket } from "../services/socket";


export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [setores, setSetores] = useState([]);


  useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        // 🔥 pega usuário
        const { data: userData } = await api.get("/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUser(userData);

        // 🔥 entra nas salas socket
        socket.emit("join_empresa", userData.empresa_id);
        socket.emit("join_setor", userData.setor_id);

        const setoresRes = await api.post(`/setores/${userData.empresa_id}`);
        setSetores(setoresRes.data);

      } catch (err) {
        console.error("Erro ao carregar dados:", err);

      }
    };

    loadData();
  }, []);


  useEffect(() => {
    const handleMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          user: data.nome,
          text: data.mensagem,
          time: new Date().toLocaleTimeString().slice(0, 5),
        },
      ]);
    };

    socket.on("receive_setor", handleMessage);

    return () => {
      socket.off("receive_setor", handleMessage);
    };
  }, []);


  const sendMessage = () => {
    if (!newMessage || !user) return;

    socket.emit("setor_message", {
      remetente_id: user.id,
      setor_id: user.setor_id,
      mensagem: newMessage,
    });

    setNewMessage("");
  };

  return (
    <div className="h-screen flex bg-[#0A0F1C] text-white">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#111827] border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          {user?.empresa_nome}
        </div>

        <div className="p-4 text-sm text-gray-400">Setores</div>

        <div className="flex-1 overflow-y-auto">
          {setores.map((item) => (
            <div
              key={item.id}
              className="px-4 py-2 hover:bg-gray-800 cursor-pointer"
            >
              #{item.nome}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 text-sm">
          <div className="font-semibold">{user?.nome}</div>
          <div className="text-xs text-gray-400 ">
            Empresa: {user?.empresa_nome}  Setor: {user?.setor_nome}
          </div>
        </div>
      </aside>

      {/* CHAT */}
      <main className="flex-1 flex flex-col">
        {/* HEADER */}
        <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between">
          <h1 className="font-semibold"># Chat</h1>
          <span className="text-sm text-green-400">Online</span>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-[#111827] border border-gray-800 rounded-xl p-3"
            >
              <div className="text-sm text-blue-400 font-semibold">
                {msg.user}
              </div>
              <div className="text-gray-200">{msg.text}</div>
              <div className="text-xs text-gray-500 text-right">
                {msg.time}
              </div>
            </div>
          ))}
        </div>

        {/* INPUT */}
        <div className="p-4 border-t border-gray-800 flex gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          />

          <button 
            onClick={sendMessage}
            className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] rounded-lg"
          >
            Enviar
          </button>
        </div>
      </main>
    </div>
  );
}

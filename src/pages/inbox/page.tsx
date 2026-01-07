import { useEffect, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { supabase, type Conversation, type Message, type Customer } from '../../lib/supabase';

type ConversationWithCustomer = Conversation & {
  customer: Customer;
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<ConversationWithCustomer[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithCustomer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*, customer:customers(*)')
      .order('last_message_at', { ascending: false });

    if (data) {
      setConversations(data as ConversationWithCustomer[]);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setLoading(true);

    const { data } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_type: 'agent',
        content: newMessage,
      })
      .select()
      .single();

    if (data) {
      setMessages([...messages, data]);
      setNewMessage('');
      
      await supabase
        .from('conversations')
        .update({
          last_message: newMessage,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', selectedConversation.id);

      loadConversations();
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="flex min-h-screen bg-gray-50">
            <div className="flex-1 ml-64 flex">
              <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
                  <p className="text-sm text-gray-600 mt-1">WhatsApp</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                        selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {conv.customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">{conv.customer.name}</h3>
                            {conv.unread_count > 0 && (
                              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{conv.last_message || 'Sem mensagens'}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(conv.last_message_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                  <>
                    <div className="bg-white border-b border-gray-200 p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {selectedConversation.customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{selectedConversation.customer.name}</h2>
                          <p className="text-sm text-gray-600">{selectedConversation.customer.phone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-md px-4 py-3 rounded-2xl ${
                              msg.sender_type === 'agent'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-900 border border-gray-200'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.sender_type === 'agent' ? 'text-blue-100' : 'text-gray-500'}`}>
                              {new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white border-t border-gray-200 p-6">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                          placeholder="Digite sua mensagem..."
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                        <button
                          onClick={sendMessage}
                          disabled={loading || !newMessage.trim()}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <i className="ri-send-plane-fill text-xl"></i>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <i className="ri-message-3-line text-6xl text-gray-300 mb-4"></i>
                      <p className="text-gray-600">Selecione uma conversa para começar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

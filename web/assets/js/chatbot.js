// ============================================
// CHATBOT — LogiStock Site Público
// Com reconhecimento e síntese de voz
// ============================================

const AssistantState = {
  isListening:  false,
  isProcessing: false,
  isSpeaking:   false,
  recognition:  null,
  synthesis:    window.speechSynthesis,
};

const ASSISTANT_CONFIG = {
  language:  'pt-BR',
  voiceRate: 1.0,
  voicePitch: 1.0,
};

// ============================================
// TOGGLE DO CHATBOT
// ============================================

function toggleChatBot() {
  const container = document.getElementById('chatbot-container');
  if (!container) return;
  container.classList.toggle('minimized');
}

// ============================================
// RECONHECIMENTO DE VOZ
// ============================================

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech Recognition não suportado neste navegador');
    document.getElementById('voice-btn')?.classList.add('disabled');
    return null;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = ASSISTANT_CONFIG.language;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    AssistantState.isListening = true;
    updateVoiceUI('listening');
  };
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
    const isFinal = event.results[event.results.length - 1].isFinal;
    if (isFinal) processVoiceCommand(transcript);
    else showTranscriptPreview(transcript);
  };
  recognition.onerror = (event) => {
    AssistantState.isListening = false;
    updateVoiceUI('idle');
    if (event.error === 'not-allowed')
      addAssistantMessage('⚠️ Permissão de microfone negada. Permita o acesso nas configurações do navegador.', 'warning');
    else if (event.error === 'no-speech')
      addAssistantMessage('Não ouvi nada. Pode repetir?', 'info');
  };
  recognition.onend = () => {
    AssistantState.isListening = false;
    if (!AssistantState.isProcessing) updateVoiceUI('idle');
  };
  return recognition;
}

function toggleVoiceRecognition() {
  if (!AssistantState.recognition) AssistantState.recognition = initSpeechRecognition();
  if (!AssistantState.recognition) { return; }
  if (AssistantState.isListening) {
    AssistantState.recognition.stop();
  } else {
    if (AssistantState.isSpeaking) AssistantState.synthesis.cancel();
    try { AssistantState.recognition.start(); } catch (e) { console.error('Erro ao iniciar reconhecimento:', e); }
  }
}

function updateVoiceUI(state) {
  const voiceBtn    = document.getElementById('voice-btn');
  const micIcon     = document.getElementById('mic-icon');
  const voiceStatus = document.getElementById('voice-status');
  voiceBtn?.classList.remove('listening', 'processing', 'speaking');
  switch (state) {
    case 'listening':
      voiceBtn?.classList.add('listening');
      if (micIcon)     micIcon.className = 'fa-solid fa-microphone';
      if (voiceStatus) { voiceStatus.textContent = '● Ouvindo...'; voiceStatus.className = 'voice-status listening'; }
      break;
    case 'processing':
      voiceBtn?.classList.add('processing');
      if (micIcon)     micIcon.className = 'fa-solid fa-spinner';
      if (voiceStatus) { voiceStatus.textContent = '⟳ Processando...'; voiceStatus.className = 'voice-status processing'; }
      break;
    case 'speaking':
      voiceBtn?.classList.add('speaking');
      if (micIcon)     micIcon.className = 'fa-solid fa-volume-high';
      if (voiceStatus) { voiceStatus.textContent = '🔊 Falando...'; voiceStatus.className = 'voice-status speaking'; }
      break;
    default:
      if (micIcon)     micIcon.className = 'fa-solid fa-microphone';
      if (voiceStatus) { voiceStatus.textContent = ''; voiceStatus.className = 'voice-status'; }
  }
}

function showTranscriptPreview(text) {
  let preview = document.getElementById('transcript-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'transcript-preview';
    preview.className = 'transcript-preview';
    const inputArea = document.querySelector('.chatbot-input-area');
    inputArea?.parentNode.insertBefore(preview, inputArea);
  }
  preview.textContent = `"${text}..."`;
}

function clearTranscriptPreview() {
  document.getElementById('transcript-preview')?.remove();
}

// ============================================
// SÍNTESE DE VOZ
// ============================================

function speak(text, callback) {
  const voiceEnabled = document.getElementById('voice-response-toggle')?.checked ?? true;
  if (!voiceEnabled || !AssistantState.synthesis) { callback?.(); return; }
  const cleanText = text
    .replace(/[*_#`]/g, '')
    .replace(/:\\w+:/g, '')
    .replace(/[📦🔧📋✅🛒🏭🎓👋●⟳🔊⚠️❌💰⚙️🔗📞🏢⭐❓📝🔐]/g, '')
    .trim();
  if (!cleanText) { callback?.(); return; }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang  = ASSISTANT_CONFIG.language;
  utterance.rate  = ASSISTANT_CONFIG.voiceRate;
  utterance.pitch = ASSISTANT_CONFIG.voicePitch;

  const voices  = AssistantState.synthesis.getVoices();
  const ptVoice = voices.find(v => v.lang.startsWith('pt'));
  if (ptVoice) utterance.voice = ptVoice;

  utterance.onstart = () => { AssistantState.isSpeaking = true;  updateVoiceUI('speaking'); };
  utterance.onend   = () => { AssistantState.isSpeaking = false; updateVoiceUI('idle'); callback?.(); };
  utterance.onerror = () => { AssistantState.isSpeaking = false; updateVoiceUI('idle'); callback?.(); };
  AssistantState.synthesis.speak(utterance);
}

// ============================================
// PROCESSAMENTO
// ============================================

function processVoiceCommand(transcript) {
  clearTranscriptPreview();
  AssistantState.isProcessing = true;
  updateVoiceUI('processing');
  addUserMessage(transcript);
  setTimeout(() => {
    const response = interpretCommand(transcript);
    AssistantState.isProcessing = false;
    addAssistantMessage(response.message, response.type);
    speak(response.message);
  }, 300);
}

function interpretCommand(input) {
  const text = input.toLowerCase().trim();

  // Ajuda
  if (matches(text, ['ajuda', 'help', 'comandos', 'o que você pode', 'o que voce pode', 'como usar']))
    return getHelp();

  // Saudações
  if (matches(text, ['olá', 'oi', 'ola', 'hey', 'bom dia', 'boa tarde', 'boa noite', 'hello']))
    return { message: 'Olá! 👋 Seja bem-vindo à **LogiStock**! Como posso te ajudar?\n\nPergunte sobre planos, funcionalidades, integrações ou contato.', type: 'info' };

  // Planos / preços
  if (matches(text, ['plano', 'preço', 'valor', 'custo', 'mensalidade', 'quanto custa', 'pricing']))
    return { message: '💰 **Nossos Planos:**\n\n• **Starter** — Para pequenas operações\n• **Pro** — Para médias empresas\n• **Enterprise** — Solução completa e personalizada\n\nAcesse a página de planos para ver os valores detalhados!', type: 'query' };

  // Funcionalidades
  if (matches(text, ['funcionalidade', 'recurso', 'o que faz', 'o que oferece', 'features', 'módulo', 'modulo']))
    return { message: '⚙️ **Principais Funcionalidades:**\n\n• 📦 Gestão de Estoque\n• 🔧 Manutenção de Máquinas\n• 📋 Ordens de Serviço\n• 🏭 Monitoramento de Produção\n• 📊 Relatórios e Dashboards\n• 🛒 Gestão de Compras\n• 🤖 Assistente IA integrado', type: 'query' };

  // Integrações
  if (matches(text, ['integraç', 'integra', 'api', 'conectar', 'sistema externo']))
    return { message: '🔗 **Integrações Disponíveis:**\n\nA LogiStock se conecta com os principais sistemas do mercado — ERP, e-commerce, transportadoras e muito mais.\n\nAcesse a página de integrações para saber tudo!', type: 'query' };

  // Contato / suporte
  if (matches(text, ['contato', 'falar', 'suporte', 'atendimento', 'vendas', 'comercial', 'email', 'telefone', 'whatsapp']))
    return { message: '📞 **Entre em Contato:**\n\nNossa equipe está pronta para te atender! Preencha o formulário de contato ou fale diretamente com um especialista.', type: 'query' };

  // Sobre
  if (matches(text, ['sobre', 'empresa', 'quem somos', 'história', 'historia', 'missão', 'missao', 'equipe']))
    return { message: '🏢 **Sobre a LogiStock:**\n\nSomos uma plataforma de ERP Industrial focada em gestão logística, controle de produção e automação operacional. Conheça mais sobre nós!', type: 'query' };

  // Depoimentos
  if (matches(text, ['depoimento', 'avaliação', 'avaliacao', 'cliente', 'opinião', 'opiniao', 'review']))
    return { message: '⭐ **O que nossos clientes dizem:**\n\nMais de 500 empresas confiam na LogiStock. Veja os depoimentos reais de quem já usa o sistema!', type: 'query' };

  // FAQ
  if (matches(text, ['dúvida', 'duvida', 'faq', 'pergunta', 'frequente', 'como funciona']))
    return { message: '❓ **Perguntas Frequentes:**\n\nEncontre respostas para as principais dúvidas sobre a LogiStock na nossa página de FAQ!', type: 'query' };

  // Blog
  if (matches(text, ['blog', 'artigo', 'conteúdo', 'conteudo', 'notícia', 'noticia', 'dica']))
    return { message: '📝 **Blog LogiStock:**\n\nAcesse nossos artigos com dicas de gestão industrial, logística e tecnologia para sua empresa!', type: 'query' };

  // Login
  if (matches(text, ['login', 'entrar', 'acessar sistema', 'painel', 'dashboard', 'logar']))
    return { message: '🔐 **Acessar o Sistema:**\n\nJá tem uma conta? Acesse o ERP Industrial agora mesmo pela página de login!', type: 'query' };

  // Padrão
  return {
    message: `Não entendi bem "**${input}**". Posso te ajudar com:\n\n• Planos e preços\n• Funcionalidades do sistema\n• Integrações\n• Contato e suporte\n• Depoimentos\n\nDiga "ajuda" para ver todos os comandos! 😊`,
    type: 'info'
  };
}

function getHelp() {
  return {
    message: `🤖 **Posso te ajudar com:**\n\n💰 **"Planos"** — Preços e planos disponíveis\n⚙️ **"Funcionalidades"** — O que o sistema oferece\n🔗 **"Integrações"** — Sistemas compatíveis\n📞 **"Contato"** — Falar com a equipe\n🏢 **"Sobre"** — Conhecer a empresa\n⭐ **"Depoimentos"** — O que clientes dizem\n❓ **"FAQ"** — Dúvidas frequentes\n📝 **"Blog"** — Artigos e dicas\n🔐 **"Login"** — Acessar o sistema\n\n🎤 Você também pode usar o **microfone**!`,
    type: 'info'
  };
}

// ============================================
// UI
// ============================================

function addUserMessage(text, _semSalvar) {
  if (!_semSalvar && window.LogiDB) LogiDB.salvarMensagemChat('user', text).catch(() => {});
  const container = document.getElementById('chatbot-messages');
  if (!container) return;
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  container.insertAdjacentHTML('beforeend', `
    <div class="message-group user-msg">
      <div class="message-bubble">${escapeHtmlChat(text)}</div>
      <span class="message-time">${time}</span>
    </div>
  `);
  container.scrollTop = container.scrollHeight;
}

function addAssistantMessage(text, type = 'info', _semSalvar) {
  if (!_semSalvar && window.LogiDB) LogiDB.salvarMensagemChat('assistant', text).catch(() => {});
  const container = document.getElementById('chatbot-messages');
  if (!container) return;
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const htmlText = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/• /g, '&bull; ');
  const typeClass = type === 'error' ? 'error-message' : type === 'warning' ? 'warning-message' : type === 'query' ? 'action-message' : '';
  container.insertAdjacentHTML('beforeend', `
    <div class="message-group assistant-msg">
      <div class="message-bubble ${typeClass}"><div>${htmlText}</div></div>
      <span class="message-time">${time}</span>
    </div>
  `);
  container.scrollTop = container.scrollHeight;
}

function escapeHtmlChat(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function matches(text, keywords) {
  return keywords.some(k => text.includes(k));
}

// ============================================
// ENVIO POR TEXTO
// ============================================

window.sendChatMessage = function () {
  const input = document.getElementById('chatbot-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  processVoiceCommand(text);
};

window.useSuggestion = function (text) {
  const input = document.getElementById('chatbot-input');
  if (input) input.value = text;
  window.sendChatMessage();
};

// ============================================
// EXPORTS GLOBAIS
// ============================================

window.toggleChatBot          = toggleChatBot;
window.toggleVoiceRecognition = toggleVoiceRecognition;
window.AssistantState         = AssistantState;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => {};
  }
  console.log('💬 Chatbot LogiStock inicializado');
  // Restaura histórico salvo no Firebase
  if (window.LogiDB) {
    LogiDB.carregarChat(30).then(hist => {
      hist.forEach(m => m.papel === 'user' ? addUserMessage(m.texto, true) : addAssistantMessage(m.texto, 'info', true));
    }).catch(() => {});
  }
});

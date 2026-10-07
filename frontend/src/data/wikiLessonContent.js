const massivosLessonContent = {
  'o-que-e-um-massivo': {
    summary:
      'Um massivo é uma ocorrência que afeta vários clientes ao mesmo tempo e possui uma causa comum na rede, na energia ou em um equipamento compartilhado.',
    objectives: [
      'Reconhecer quando uma ocorrência pode ser coletiva.',
      'Entender por que a confirmação deve vir antes da comunicação.',
      'Diferenciar impacto amplo de um problema isolado.',
    ],
    sections: [
      {
        eyebrow: 'CONCEITO',
        title: 'Uma causa compartilhada, vários clientes afetados',
        paragraphs: [
          'Chamamos de massivo o evento em que diferentes clientes apresentam sintomas relacionados porque dependem do mesmo ponto da infraestrutura.',
          'O alcance pode envolver uma rua, um bairro, uma rota, uma CTO, uma região ou outro conjunto identificado pela equipe técnica.',
        ],
      },
      {
        eyebrow: 'NA PRÁTICA',
        title: 'O que muda no atendimento',
        paragraphs: [
          'Quando existe um massivo confirmado, o foco deixa de ser repetir testes individuais em cada atendimento. A prioridade passa a ser validar o alerta, registrar corretamente o cliente afetado e comunicar a situação com clareza.',
        ],
        bullets: [
          'Consulte os alertas e comunicados internos.',
          'Confirme se a localização do cliente está dentro da área afetada.',
          'Evite prometer horário exato de normalização sem confirmação.',
          'Registre o vínculo do atendimento com a ocorrência coletiva.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'ATENÇÃO',
        title: 'Suspeita não é confirmação',
        paragraphs: [
          'Vários contatos parecidos são um sinal importante, mas não bastam para afirmar que há um massivo. A confirmação deve seguir o procedimento interno e as informações publicadas pelo NOC.',
        ],
        tone: 'warning',
      },
    ],
    example: {
      title: 'Exemplo rápido',
      scenario:
        'Em poucos minutos, clientes do mesmo bairro relatam perda total de conexão. O painel interno também apresenta aumento de equipamentos offline na região.',
      response:
        'A combinação dos sinais justifica consultar o alerta do NOC e validar a área afetada antes de informar que existe um massivo.',
    },
    checklist: [
      'Existe alerta interno relacionado?',
      'Os clientes afetados pertencem à mesma região ou estrutura?',
      'O sintoma e o horário de início são semelhantes?',
      'A ocorrência foi confirmada pela área responsável?',
    ],
    takeaways: [
      'Massivo é uma ocorrência coletiva com causa compartilhada.',
      'A comunicação deve ser baseada em confirmação interna.',
      'O registro correto ajuda a operação e evita diagnósticos repetidos.',
    ],
    knowledgeCheck: {
      question: 'Qual é a primeira atitude ao suspeitar de um massivo?',
      answer:
        'Consultar os alertas internos e confirmar a abrangência antes de comunicar o cliente.',
    },
  },
  'diferenca-entre-massivo-chamado-individual-e-instabilidade-local': {
    summary:
      'Classificar corretamente a ocorrência evita encaminhamentos desnecessários e melhora a qualidade da orientação dada ao cliente.',
    objectives: [
      'Comparar massivo, chamado individual e instabilidade local.',
      'Identificar o alcance provável de cada situação.',
      'Escolher a próxima ação com mais segurança.',
    ],
    comparison: {
      headers: ['Situação', 'Abrangência', 'Sinal principal', 'Próxima ação'],
      rows: [
        [
          'Massivo',
          'Vários clientes ou uma área',
          'Sintomas semelhantes e causa compartilhada',
          'Validar alerta e seguir a comunicação coletiva',
        ],
        [
          'Chamado individual',
          'Um cliente',
          'Falha específica sem alerta relacionado',
          'Executar a triagem e registrar o chamado',
        ],
        [
          'Instabilidade local',
          'Ambiente do cliente',
          'Wi-Fi, cabo, energia ou equipamento interno',
          'Orientar testes locais antes de escalar',
        ],
      ],
    },
    sections: [
      {
        eyebrow: 'MASSIVO',
        title: 'Quando o problema ultrapassa um único atendimento',
        paragraphs: [
          'O massivo apresenta correlação entre clientes, localização, infraestrutura ou horário. A ocorrência costuma ser acompanhada por alerta, análise do NOC ou indicadores coletivos.',
        ],
      },
      {
        eyebrow: 'INDIVIDUAL',
        title: 'Quando o diagnóstico pertence ao cliente',
        paragraphs: [
          'Um chamado individual é aberto quando não há evidência de impacto coletivo e a falha permanece após a triagem prevista. O histórico deve registrar sintomas, testes e evidências.',
        ],
      },
      {
        eyebrow: 'LOCAL',
        title: 'Quando a conexão existe, mas o ambiente interfere',
        paragraphs: [
          'A instabilidade local pode estar ligada à cobertura Wi-Fi, distância do roteador, interferência, cabo, energia ou ao dispositivo utilizado. Nesses casos, a orientação deve separar a rede do provedor do ambiente interno.',
        ],
        tone: 'info',
      },
    ],
    checklist: [
      'Há outros clientes com o mesmo sintoma?',
      'Existe alerta para a região?',
      'O problema ocorre também por cabo?',
      'Os equipamentos estão energizados e conectados corretamente?',
      'A falha continua após os testes básicos?',
    ],
    takeaways: [
      'Massivo envolve impacto coletivo.',
      'Chamado individual exige triagem e evidências específicas.',
      'Instabilidade local deve ser isolada com testes no ambiente do cliente.',
    ],
    knowledgeCheck: {
      question: 'Sem alerta e com apenas um cliente afetado, qual fluxo deve ser iniciado?',
      answer: 'A triagem individual, registrando sintomas e testes realizados.',
    },
  },
  'como-identificar-sinais-de-um-massivo': {
    summary:
      'A identificação começa pela correlação de informações: volume de contatos, região, horário, sintomas e indicadores operacionais.',
    objectives: [
      'Reconhecer sinais que merecem investigação coletiva.',
      'Cruzar informações sem tirar conclusões precipitadas.',
      'Organizar evidências para acionar o NOC.',
    ],
    sections: [
      {
        eyebrow: 'SINAIS',
        title: 'O que observar durante a operação',
        bullets: [
          'Aumento repentino de contatos com o mesmo sintoma.',
          'Clientes próximos ou ligados à mesma estrutura.',
          'Horários de início muito semelhantes.',
          'Mudança incomum em indicadores do painel.',
          'Alerta ou relato de equipe de campo.',
        ],
      },
      {
        eyebrow: 'CORRELAÇÃO',
        title: 'Um sinal isolado pode enganar',
        paragraphs: [
          'A força da suspeita cresce quando dois ou mais sinais aparecem juntos. Volume de contatos sem relação geográfica, por exemplo, pode ter outra causa e precisa ser investigado.',
        ],
        tone: 'warning',
      },
      {
        eyebrow: 'EVIDÊNCIA',
        title: 'Registre o que pode ser confirmado',
        paragraphs: [
          'Anote região, horário, sintoma, quantidade aproximada de relatos e qualquer indicador disponível. Informações objetivas aceleram a validação técnica.',
        ],
      },
    ],
    checklist: [
      'Sintoma predominante identificado.',
      'Região ou estrutura em comum identificada.',
      'Horário aproximado do início registrado.',
      'Indicadores e alertas consultados.',
      'Evidências prontas para o acionamento.',
    ],
    takeaways: [
      'Procure padrões, não apenas quantidade.',
      'Cruze atendimento, localização e monitoramento.',
      'Comunique fatos observados, não suposições.',
    ],
  },
  'conferindo-alertas-internos': {
    summary:
      'Os alertas internos são a principal referência para confirmar ocorrências, acompanhar atualizações e manter a comunicação alinhada.',
    objectives: [
      'Consultar o alerta certo antes de orientar o cliente.',
      'Ler abrangência, status e horário de atualização.',
      'Evitar o uso de informações antigas.',
    ],
    sections: [
      {
        eyebrow: 'LEITURA',
        title: 'Os campos que não podem passar despercebidos',
        bullets: [
          'Status atual da ocorrência.',
          'Região, estrutura ou clientes abrangidos.',
          'Horário de início e última atualização.',
          'Orientação aprovada para atendimento.',
          'Previsão, somente quando oficialmente publicada.',
        ],
      },
      {
        eyebrow: 'VALIDADE',
        title: 'Sempre confira a última atualização',
        paragraphs: [
          'Um alerta pode evoluir durante o atendimento. Antes de responder, verifique se houve mudança de status, ampliação da área ou nova orientação.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'PADRÃO',
        title: 'Use a mesma fonte que a equipe',
        paragraphs: [
          'A comunicação deve seguir o canal oficial definido pela operação. Mensagens paralelas e informações não confirmadas geram respostas diferentes para clientes afetados pela mesma ocorrência.',
        ],
      },
    ],
    checklist: [
      'Alerta correto localizado.',
      'Área afetada comparada com o endereço do cliente.',
      'Última atualização conferida.',
      'Orientação oficial utilizada.',
      'Atendimento registrado com a referência da ocorrência.',
    ],
    takeaways: [
      'Alerta antigo pode gerar orientação errada.',
      'Abrangência e status devem ser confirmados em cada atendimento.',
      'A fonte oficial mantém toda a equipe alinhada.',
    ],
  },
  'verificando-regiao-cto-e-clientes-afetados': {
    summary:
      'A validação geográfica e estrutural confirma se o cliente realmente está dentro do impacto informado.',
    objectives: [
      'Comparar o cadastro do cliente com a área do alerta.',
      'Usar CTO e região como evidências, não como suposição.',
      'Evitar associar clientes fora da abrangência.',
    ],
    sections: [
      {
        eyebrow: 'LOCALIZAÇÃO',
        title: 'Comece pelo cadastro correto',
        paragraphs: [
          'Confirme cidade, bairro, rua e demais referências disponíveis. Um nome de bairro semelhante ou um cadastro incompleto pode levar à classificação errada.',
        ],
      },
      {
        eyebrow: 'ESTRUTURA',
        title: 'CTO ajuda a delimitar o impacto',
        paragraphs: [
          'Quando a informação estiver disponível, compare a CTO ou a estrutura vinculada ao cliente com o alerta. A correspondência fortalece a confirmação; a divergência exige nova triagem.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'DECISÃO',
        title: 'Dentro ou fora da área afetada',
        bullets: [
          'Dentro da área: siga a orientação do massivo.',
          'Fora da área: prossiga com a triagem individual.',
          'Informação inconclusiva: reúna evidências e valide com o NOC.',
        ],
      },
    ],
    checklist: [
      'Cadastro do cliente confirmado.',
      'Região comparada com o alerta.',
      'CTO ou estrutura verificada quando disponível.',
      'Sintoma compatível com a ocorrência.',
      'Decisão registrada no atendimento.',
    ],
    takeaways: [
      'Proximidade não garante que o cliente esteja no mesmo massivo.',
      'A estrutura vinculada ajuda a reduzir falsos positivos.',
      'Dúvida de abrangência deve ser validada antes da comunicação.',
    ],
  },
  'como-acionar-o-noc-corretamente': {
    summary:
      'Um bom acionamento entrega contexto suficiente para análise sem excesso de mensagens ou informações vagas.',
    objectives: [
      'Preparar um acionamento objetivo.',
      'Reunir evidências mínimas antes do contato.',
      'Usar o canal e o formato definidos pela operação.',
    ],
    sections: [
      {
        eyebrow: 'ANTES DE ACIONAR',
        title: 'Organize as evidências',
        bullets: [
          'Região e estrutura possivelmente afetadas.',
          'Sintoma predominante.',
          'Horário aproximado do início.',
          'Quantidade ou exemplos de clientes.',
          'Indicadores e alertas já consultados.',
        ],
      },
      {
        eyebrow: 'MENSAGEM',
        title: 'Seja direto e verificável',
        paragraphs: [
          'A mensagem deve permitir que o NOC entenda o cenário rapidamente. Evite termos genéricos como “está tudo fora” sem região, horário ou referência.',
        ],
        tone: 'warning',
      },
      {
        eyebrow: 'ACOMPANHAMENTO',
        title: 'Aguarde o retorno no canal correto',
        paragraphs: [
          'Após o acionamento, acompanhe a atualização oficial e evite duplicar solicitações sem nova evidência. Se o cenário mudar, complemente a mensagem original.',
        ],
      },
    ],
    example: {
      title: 'Modelo de acionamento',
      scenario:
        'Possível ocorrência coletiva no bairro Centro, iniciada por volta de 14h20. Três clientes da mesma região relatam perda total; painel apresenta aumento de offline. Alerta interno ainda não localizado.',
      response:
        'Solicito validação de possível massivo e orientação para os atendimentos em andamento.',
    },
    checklist: [
      'Canal oficial utilizado.',
      'Região e horário informados.',
      'Sintoma descrito sem exageros.',
      'Clientes ou indicadores de exemplo incluídos.',
      'Atualizações acompanhadas no mesmo contexto.',
    ],
    takeaways: [
      'Evidência objetiva acelera a análise.',
      'Acionamento não deve afirmar o que ainda não foi confirmado.',
      'Atualizações devem permanecer centralizadas.',
    ],
  },
  'registro-correto-no-atendimento': {
    summary:
      'O registro transforma o atendimento em informação útil para acompanhamento, auditoria e continuidade da operação.',
    objectives: [
      'Registrar o vínculo com a ocorrência coletiva.',
      'Documentar a orientação transmitida.',
      'Facilitar a continuidade por outro atendente.',
    ],
    sections: [
      {
        eyebrow: 'REGISTRO',
        title: 'O que deve constar no histórico',
        bullets: [
          'Sintoma relatado pelo cliente.',
          'Região ou estrutura validada.',
          'Alerta ou ocorrência relacionada.',
          'Orientação fornecida.',
          'Status no momento do encerramento.',
        ],
      },
      {
        eyebrow: 'QUALIDADE',
        title: 'Escreva para quem vai ler depois',
        paragraphs: [
          'O histórico deve ser claro mesmo para uma pessoa que não participou do atendimento. Evite abreviações ambíguas, frases soltas e registros que não expliquem a decisão tomada.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'PRIVACIDADE',
        title: 'Registre apenas o necessário',
        paragraphs: [
          'Não inclua senhas, dados sensíveis desnecessários ou comentários pessoais. O histórico deve ser profissional e relacionado à resolução.',
        ],
        tone: 'warning',
      },
    ],
    example: {
      title: 'Exemplo de histórico',
      scenario:
        'Cliente sem conexão desde 15h10. Endereço e CTO compatíveis com o alerta interno da região Norte.',
      response:
        'Cliente orientado sobre ocorrência coletiva em análise, sem promessa de horário. Atendimento vinculado ao alerta e encerrado com orientação para aguardar a atualização.',
    },
    checklist: [
      'Sintoma e horário registrados.',
      'Validação da abrangência registrada.',
      'Orientação ao cliente descrita.',
      'Nenhum dado sensível incluído.',
      'Texto compreensível para continuidade.',
    ],
    takeaways: [
      'Registro completo evita retrabalho.',
      'A decisão deve ser sustentada por evidências.',
      'Histórico profissional protege cliente e equipe.',
    ],
  },
  'como-iniciar-o-atendimento': {
    summary:
      'O início do atendimento deve acolher o cliente, confirmar o cenário e preparar uma comunicação segura sobre a ocorrência.',
    objectives: [
      'Abrir a conversa com clareza e empatia.',
      'Confirmar dados essenciais sem prolongar a espera.',
      'Evitar conclusões antes da validação.',
    ],
    sections: [
      {
        eyebrow: 'ABERTURA',
        title: 'Acolha antes de explicar',
        paragraphs: [
          'Cumprimente, identifique a necessidade e reconheça o impacto relatado. O cliente precisa perceber que sua situação foi compreendida antes de receber uma orientação técnica.',
        ],
      },
      {
        eyebrow: 'CONFIRMAÇÃO',
        title: 'Faça perguntas curtas e úteis',
        bullets: [
          'Qual é o sintoma apresentado?',
          'Desde quando ocorre?',
          'Todos os dispositivos foram afetados?',
          'Os equipamentos estão ligados?',
          'O endereço do cadastro está correto?',
        ],
      },
      {
        eyebrow: 'TRANSIÇÃO',
        title: 'Avise que fará uma consulta',
        paragraphs: [
          'Explique de forma breve que você verificará os alertas da região. Isso organiza a expectativa e evita silêncio sem contexto durante a análise.',
        ],
        tone: 'info',
      },
    ],
    example: {
      title: 'Abertura recomendada',
      scenario: 'O cliente informa que está sem conexão e demonstra irritação.',
      response:
        'Entendo como isso atrapalha sua rotina. Vou confirmar algumas informações e consultar agora se existe alguma ocorrência na sua região.',
    },
    checklist: [
      'Cliente acolhido.',
      'Sintoma e horário confirmados.',
      'Cadastro validado.',
      'Consulta ao alerta informada.',
      'Nenhuma causa afirmada antes da validação.',
    ],
    takeaways: [
      'Empatia e objetividade podem coexistir.',
      'Perguntas iniciais devem apoiar a decisão.',
      'A consulta deve ser explicada ao cliente.',
    ],
  },
  'frases-recomendadas-para-informar-instabilidade': {
    summary:
      'Frases bem construídas informam o cenário sem ampliar a tensão, esconder informações ou criar promessas indevidas.',
    objectives: [
      'Comunicar uma instabilidade de forma transparente.',
      'Usar linguagem simples e profissional.',
      'Adaptar a mensagem sem perder o padrão.',
    ],
    sections: [
      {
        eyebrow: 'CONFIRMAÇÃO',
        title: 'Informe o que já foi validado',
        bullets: [
          '“Identificamos uma instabilidade que afeta sua região.”',
          '“Nossa equipe técnica já está analisando a ocorrência.”',
          '“Seu atendimento está relacionado ao alerta que está em acompanhamento.”',
        ],
      },
      {
        eyebrow: 'EXPECTATIVA',
        title: 'Explique o próximo passo',
        bullets: [
          '“A normalização será comunicada assim que houver uma atualização confirmada.”',
          '“Neste momento, a orientação é aguardar a atuação da equipe técnica.”',
          '“Vou registrar seu atendimento junto à ocorrência para manter o histórico correto.”',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'EVITE',
        title: 'Não transforme estimativa em promessa',
        bullets: [
          '“Vai voltar em alguns minutos.”',
          '“Com certeza estará normal até tal horário.”',
          '“É só reiniciar que resolve.”',
          '“Não há nada que possamos fazer.”',
        ],
        tone: 'warning',
      },
    ],
    checklist: [
      'Ocorrência confirmada antes da frase.',
      'Linguagem simples e sem jargões.',
      'Próximo passo explicado.',
      'Nenhum prazo inventado.',
      'Tom respeitoso mantido.',
    ],
    takeaways: [
      'Diga o que se sabe e o que está sendo feito.',
      'Evite garantias sem confirmação.',
      'A mensagem deve orientar, não apenas informar.',
    ],
  },
  'como-comunicar-previsao': {
    summary:
      'Uma previsão deve ser apresentada como estimativa oficial, nunca como garantia de horário para normalização.',
    objectives: [
      'Diferenciar previsão de prazo confirmado.',
      'Comunicar incerteza sem parecer evasivo.',
      'Atualizar o cliente quando a estimativa mudar.',
    ],
    sections: [
      {
        eyebrow: 'PREVISÃO',
        title: 'Use somente a informação publicada',
        paragraphs: [
          'Se houver uma previsão oficial, informe que ela representa a estimativa disponível naquele momento e pode ser revista conforme o avanço técnico.',
        ],
      },
      {
        eyebrow: 'SEM PREVISÃO',
        title: 'Transparência é melhor que um prazo inventado',
        paragraphs: [
          'Quando não existe estimativa, diga isso com clareza e destaque que a equipe está atuando. Criar um horário para tranquilizar o cliente gera frustração e quebra de confiança.',
        ],
        tone: 'warning',
      },
      {
        eyebrow: 'ATUALIZAÇÃO',
        title: 'Mudanças fazem parte da ocorrência',
        paragraphs: [
          'Caso a previsão seja alterada, use a informação mais recente e não esconda a mudança. Explique que a estimativa foi atualizada após nova análise técnica.',
        ],
        tone: 'info',
      },
    ],
    example: {
      title: 'Resposta segura',
      scenario: 'O alerta informa previsão estimada para 18h.',
      response:
        'A estimativa informada pela equipe técnica é de normalização até aproximadamente 18h. Como se trata de uma previsão, ela pode ser atualizada conforme o andamento do reparo.',
    },
    checklist: [
      'Previsão obtida no canal oficial.',
      'Estimativa apresentada sem garantia.',
      'Possibilidade de atualização explicada.',
      'Horário não arredondado ou alterado por conta própria.',
      'Registro compatível com a informação transmitida.',
    ],
    takeaways: [
      'Previsão não é promessa.',
      'Sem estimativa oficial, não invente prazo.',
      'Use sempre a atualização mais recente.',
    ],
  },
  'como-encerrar-o-atendimento': {
    summary:
      'O encerramento confirma o entendimento do cliente, reforça a orientação e deixa o histórico pronto para continuidade.',
    objectives: [
      'Recapitular a situação em poucas palavras.',
      'Confirmar o próximo passo esperado.',
      'Finalizar com postura profissional.',
    ],
    sections: [
      {
        eyebrow: 'RECAPITULAÇÃO',
        title: 'Feche a conversa sem deixar dúvida',
        paragraphs: [
          'Resuma a ocorrência, a atuação em andamento e a orientação fornecida. Uma frase curta reduz novos contatos motivados apenas por falta de clareza.',
        ],
      },
      {
        eyebrow: 'CONFIRMAÇÃO',
        title: 'Verifique se o cliente compreendeu',
        paragraphs: [
          'Pergunte se ficou alguma dúvida sobre o cenário ou sobre o que deve ser feito. Evite encerrar imediatamente após transmitir a informação.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'DESPEDIDA',
        title: 'Mantenha o cuidado até a última mensagem',
        paragraphs: [
          'Agradeça a compreensão e finalize de forma objetiva. Mesmo em uma ocorrência coletiva, cada atendimento deve preservar o respeito e a atenção.',
        ],
      },
    ],
    example: {
      title: 'Encerramento recomendado',
      scenario: 'Massivo confirmado, sem previsão oficial.',
      response:
        'A ocorrência da sua região já está em análise pela equipe técnica e ainda não possui previsão confirmada. Seu atendimento ficou registrado. Posso ajudar com mais alguma dúvida antes de encerrarmos?',
    },
    checklist: [
      'Situação resumida.',
      'Previsão tratada corretamente.',
      'Próximo passo reforçado.',
      'Dúvidas finais verificadas.',
      'Histórico concluído.',
    ],
    takeaways: [
      'Recapitular evita interpretações diferentes.',
      'Confirme o entendimento antes de finalizar.',
      'O tom profissional deve permanecer até o fim.',
    ],
  },
  'como-manter-o-controle-da-conversa': {
    summary:
      'Conduzir a conversa significa organizar o atendimento com calma, foco e limites claros, mesmo quando o cliente está insatisfeito.',
    objectives: [
      'Reduzir interrupções e repetições.',
      'Manter o foco no que pode ser confirmado.',
      'Responder à insatisfação sem confronto.',
    ],
    sections: [
      {
        eyebrow: 'ESCUTA',
        title: 'Deixe o cliente concluir o ponto principal',
        paragraphs: [
          'Interromper cedo demais aumenta a tensão. Escute o relato, reconheça o impacto e depois organize as informações necessárias para a análise.',
        ],
      },
      {
        eyebrow: 'CONDUÇÃO',
        title: 'Explique cada próximo passo',
        bullets: [
          'Diga o que será consultado.',
          'Faça uma pergunta por vez.',
          'Retome o foco quando a conversa se dispersar.',
          'Resuma o que já foi confirmado.',
        ],
      },
      {
        eyebrow: 'LIMITE',
        title: 'Não discuta nem aceite agressões',
        paragraphs: [
          'Mantenha o tom neutro, reafirme que deseja ajudar e siga o procedimento interno para situações de desrespeito. Controle da conversa não significa elevar o tom.',
        ],
        tone: 'warning',
      },
    ],
    checklist: [
      'Relato principal compreendido.',
      'Impacto reconhecido.',
      'Perguntas objetivas realizadas.',
      'Informações confirmadas resumidas.',
      'Limites profissionais preservados.',
    ],
    takeaways: [
      'Escuta ativa reduz resistência.',
      'Próximos passos claros dão direção à conversa.',
      'Calma e limite são parte do atendimento profissional.',
    ],
  },
  'palavras-que-devem-ser-evitadas': {
    summary:
      'Algumas expressões aumentam a insegurança, parecem desinteresse ou criam garantias que a equipe não pode cumprir.',
    objectives: [
      'Identificar frases de risco.',
      'Substituir respostas negativas por orientações claras.',
      'Manter precisão sem linguagem excessivamente técnica.',
    ],
    comparison: {
      headers: ['Evite', 'Por quê', 'Prefira'],
      rows: [
        ['“Não sei.”', 'Transmite abandono', '“Vou verificar essa informação.”'],
        ['“É problema geral.”', 'É vago e impreciso', '“Há uma ocorrência confirmada na sua região.”'],
        ['“Vai voltar logo.”', 'Cria promessa sem base', '“Ainda não há previsão confirmada.”'],
        ['“Você precisa esperar.”', 'Soa impositivo', '“A orientação neste momento é aguardar a atuação técnica.”'],
      ],
    },
    sections: [
      {
        eyebrow: 'LINGUAGEM',
        title: 'Troque negativas secas por ações',
        paragraphs: [
          'A resposta pode ser honesta sem encerrar a conversa. Quando uma informação ainda não está disponível, explique o que será consultado ou qual acompanhamento está em andamento.',
        ],
      },
      {
        eyebrow: 'JARGÃO',
        title: 'Fale para o cliente, não para o sistema',
        paragraphs: [
          'Termos técnicos só devem ser usados quando ajudam a compreensão. Prefira explicar o efeito da ocorrência e a ação em andamento.',
        ],
        tone: 'info',
      },
    ],
    checklist: [
      'Nenhuma promessa sem base.',
      'Nenhuma expressão de abandono.',
      'Jargões traduzidos para linguagem simples.',
      'Orientação apresentada junto da informação.',
      'Tom neutro e respeitoso.',
    ],
    takeaways: [
      'Palavras moldam a confiança do cliente.',
      'Honestidade não precisa soar fria.',
      'Sempre que possível, apresente uma ação ou próximo passo.',
    ],
  },
  'modelos-de-resposta-rapida': {
    summary:
      'Modelos aceleram o atendimento, mas precisam ser adaptados ao cenário confirmado e ao tom da conversa.',
    objectives: [
      'Usar respostas padrão sem parecer automático.',
      'Escolher o modelo adequado ao status da ocorrência.',
      'Personalizar informações essenciais.',
    ],
    sections: [
      {
        eyebrow: 'CONFIRMAÇÃO',
        title: 'Massivo confirmado',
        paragraphs: [
          '“Identificamos uma ocorrência que afeta sua região. A equipe técnica já está atuando e seu atendimento será registrado junto ao alerta.”',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'ANÁLISE',
        title: 'Possível massivo ainda não confirmado',
        paragraphs: [
          '“Identificamos sinais que precisam de validação pela equipe responsável. Vou registrar as informações e acompanhar a confirmação antes de passar uma conclusão.”',
        ],
      },
      {
        eyebrow: 'SEM PREVISÃO',
        title: 'Ocorrência confirmada sem estimativa',
        paragraphs: [
          '“A equipe está trabalhando na normalização, mas ainda não existe uma previsão oficial. Assim que houver uma atualização confirmada, ela será disponibilizada pelos canais internos.”',
        ],
        tone: 'warning',
      },
    ],
    checklist: [
      'Modelo compatível com o status real.',
      'Região ou contexto personalizado.',
      'Previsão somente quando oficial.',
      'Texto revisado antes do envio.',
      'Resposta adequada ao canal de atendimento.',
    ],
    takeaways: [
      'Modelo é ponto de partida, não resposta cega.',
      'Personalize apenas com informações confirmadas.',
      'Revise tom, dados e previsão antes de enviar.',
    ],
  },
  'atendimento-humanizado-em-instabilidade': {
    summary:
      'Humanizar é reconhecer o impacto real da falha e orientar com presença, sem perder objetividade ou precisão.',
    objectives: [
      'Demonstrar empatia de forma natural.',
      'Evitar respostas mecânicas.',
      'Equilibrar acolhimento e agilidade.',
    ],
    sections: [
      {
        eyebrow: 'EMPATIA',
        title: 'Reconheça o impacto específico',
        paragraphs: [
          'Em vez de repetir apenas “entendo”, conecte a resposta ao que o cliente relatou: trabalho interrompido, estudo, comunicação ou outro uso importante.',
        ],
      },
      {
        eyebrow: 'PRESENÇA',
        title: 'Mostre que o atendimento está avançando',
        paragraphs: [
          'Explique brevemente o que está sendo consultado e retorne com a informação organizada. Silêncio prolongado ou mensagens genéricas passam sensação de abandono.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'EQUILÍBRIO',
        title: 'Empatia não é prometer o impossível',
        paragraphs: [
          'Acolher o cliente não exige criar prazo, desconto ou solução que não esteja autorizada. A confiança vem da clareza e da consistência.',
        ],
        tone: 'warning',
      },
    ],
    example: {
      title: 'Resposta humanizada',
      scenario: 'Cliente informa que depende da conexão para uma reunião.',
      response:
        'Entendo que a conexão é importante para sua reunião. Confirmei uma ocorrência na região e a equipe técnica já está atuando. Ainda não há previsão oficial, mas vou registrar corretamente seu atendimento.',
    },
    checklist: [
      'Impacto do cliente reconhecido.',
      'Resposta adaptada ao relato.',
      'Ação em andamento explicada.',
      'Nenhuma promessa indevida.',
      'Tom respeitoso mantido.',
    ],
    takeaways: [
      'Humanização começa pela escuta.',
      'Clareza transmite cuidado.',
      'Empatia deve acompanhar informações precisas.',
    ],
  },
  'modelo-de-mensagem-para-massivo': {
    summary:
      'Um bom modelo reúne confirmação, impacto, atuação e expectativa em uma mensagem curta e adaptável.',
    objectives: [
      'Montar uma mensagem completa.',
      'Adaptar o texto ao status da ocorrência.',
      'Evitar excesso de informação técnica.',
    ],
    sections: [
      {
        eyebrow: 'ESTRUTURA',
        title: 'Quatro partes essenciais',
        bullets: [
          'Reconhecimento do contato.',
          'Confirmação objetiva da ocorrência.',
          'Informação sobre a atuação técnica.',
          'Orientação ou expectativa disponível.',
        ],
      },
      {
        eyebrow: 'MODELO',
        title: 'Mensagem base',
        paragraphs: [
          '“Confirmamos uma instabilidade que afeta sua região. Nossa equipe técnica já está atuando para normalizar o serviço. Neste momento, [há previsão estimada de...] / [ainda não há previsão oficial]. Seu atendimento ficará registrado junto à ocorrência.”',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'REVISÃO',
        title: 'Antes de enviar',
        paragraphs: [
          'Substitua os campos, confira o status mais recente e remova qualquer trecho que não se aplique ao caso. Nunca envie as duas opções de previsão.',
        ],
        tone: 'warning',
      },
    ],
    checklist: [
      'Ocorrência confirmada.',
      'Região correta.',
      'Status atualizado.',
      'Trecho de previsão escolhido corretamente.',
      'Mensagem revisada e personalizada.',
    ],
    takeaways: [
      'A mensagem deve ser curta e completa.',
      'Campos de modelo precisam ser revisados.',
      'Status e previsão devem vir da fonte oficial.',
    ],
  },
  'checklist-de-validacao': {
    summary:
      'O checklist reduz esquecimentos e ajuda a equipe a tomar decisões consistentes durante momentos de maior volume.',
    objectives: [
      'Seguir uma ordem simples de validação.',
      'Separar suspeita de confirmação.',
      'Registrar a decisão tomada.',
    ],
    steps: [
      {
        title: 'Confirmar o relato',
        description: 'Identifique sintoma, horário aproximado e dispositivos afetados.',
      },
      {
        title: 'Validar o cadastro',
        description: 'Confira endereço, região e estrutura vinculada quando disponível.',
      },
      {
        title: 'Consultar alertas',
        description: 'Leia abrangência, status e última atualização.',
      },
      {
        title: 'Correlacionar evidências',
        description: 'Compare o cliente com o impacto descrito no alerta.',
      },
      {
        title: 'Comunicar e registrar',
        description: 'Use a orientação oficial e documente a decisão no histórico.',
      },
    ],
    sections: [
      {
        eyebrow: 'REGRA',
        title: 'Não pule da suspeita para a resposta',
        paragraphs: [
          'Mesmo durante picos de atendimento, siga as etapas essenciais. Uma associação incorreta pode esconder um problema individual ou transmitir uma previsão que não se aplica ao cliente.',
        ],
        tone: 'warning',
      },
    ],
    checklist: [
      'Relato confirmado.',
      'Cadastro validado.',
      'Alerta consultado.',
      'Abrangência comparada.',
      'Orientação oficial aplicada.',
      'Histórico registrado.',
    ],
    takeaways: [
      'A ordem do checklist reduz erro.',
      'Confirme abrangência antes de comunicar.',
      'Registro encerra o ciclo de validação.',
    ],
  },
  'frases-recomendadas': {
    summary:
      'Este guia reúne frases curtas para abertura, confirmação, ausência de previsão, atualização e encerramento.',
    objectives: [
      'Consultar frases aprovadas rapidamente.',
      'Escolher a mensagem adequada ao momento.',
      'Personalizar sem alterar o sentido.',
    ],
    sections: [
      {
        eyebrow: 'ABERTURA',
        title: 'Para acolher e iniciar a análise',
        bullets: [
          '“Entendo o impacto dessa situação e vou consultar agora as informações da sua região.”',
          '“Obrigado pelos detalhes. Vou validar o cenário antes de orientar você.”',
        ],
      },
      {
        eyebrow: 'STATUS',
        title: 'Para informar a ocorrência',
        bullets: [
          '“Há uma instabilidade confirmada na sua região e a equipe técnica já está atuando.”',
          '“A ocorrência ainda está em validação. Vou registrar os dados sem antecipar uma conclusão.”',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'ENCERRAMENTO',
        title: 'Para recapitular e finalizar',
        bullets: [
          '“Seu atendimento ficou registrado junto à ocorrência.”',
          '“Neste momento, a orientação é aguardar a atualização oficial da equipe técnica.”',
          '“Posso esclarecer mais alguma dúvida sobre o atendimento?”',
        ],
      },
    ],
    checklist: [
      'Frase compatível com o status.',
      'Informações personalizadas.',
      'Nenhum prazo inventado.',
      'Linguagem simples.',
      'Revisão antes do envio.',
    ],
    takeaways: [
      'Escolha a frase pelo momento do atendimento.',
      'Preserve o sentido ao personalizar.',
      'Não use um modelo para substituir a validação.',
    ],
  },
  'procedimento-noc': {
    summary:
      'O procedimento organiza a passagem de informações entre atendimento e NOC, da suspeita ao encerramento da ocorrência.',
    objectives: [
      'Entender as responsabilidades de cada etapa.',
      'Enviar evidências úteis ao NOC.',
      'Acompanhar atualizações sem duplicar acionamentos.',
    ],
    steps: [
      {
        title: 'Detectar',
        description: 'Identifique padrões nos atendimentos e nos indicadores disponíveis.',
      },
      {
        title: 'Validar',
        description: 'Consulte alertas e confirme região, estrutura, sintoma e horário.',
      },
      {
        title: 'Acionar',
        description: 'Envie um resumo objetivo pelo canal operacional definido.',
      },
      {
        title: 'Comunicar',
        description: 'Use somente o status e a orientação confirmados.',
      },
      {
        title: 'Acompanhar',
        description: 'Observe atualizações até a normalização ou nova orientação.',
      },
      {
        title: 'Registrar',
        description: 'Documente o vínculo e a informação transmitida ao cliente.',
      },
    ],
    sections: [
      {
        eyebrow: 'ALINHAMENTO',
        title: 'Atendimento e NOC trabalham com o mesmo contexto',
        paragraphs: [
          'O atendimento reúne sinais da ponta; o NOC confirma o comportamento da infraestrutura. O fluxo funciona melhor quando as duas áreas compartilham informações objetivas e atualizadas.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'DISCIPLINA',
        title: 'Evite mensagens duplicadas',
        paragraphs: [
          'Use o contexto já aberto e acrescente apenas novas evidências. Acionamentos repetidos sem informação adicional dificultam o acompanhamento.',
        ],
        tone: 'warning',
      },
    ],
    checklist: [
      'Sinais correlacionados.',
      'Informações mínimas reunidas.',
      'Canal oficial utilizado.',
      'Atualizações acompanhadas.',
      'Comunicação e histórico alinhados.',
    ],
    takeaways: [
      'O NOC precisa de evidências, não apenas suspeitas.',
      'Centralizar atualizações melhora o acompanhamento.',
      'A comunicação ao cliente depende do status confirmado.',
    ],
  },
  'questionario-final': {
    summary:
      'Revise os pontos centrais do curso antes de concluir a trilha de Massivos.',
    objectives: [
      'Reforçar decisões essenciais do atendimento.',
      'Revisar comunicação, validação e registro.',
      'Identificar pontos que precisam de nova leitura.',
    ],
    sections: [
      {
        eyebrow: 'QUESTÃO 1',
        title: 'Vários clientes da mesma região estão sem conexão. O que fazer primeiro?',
        paragraphs: [
          'Resposta esperada: consultar os alertas internos e correlacionar região, sintomas e horário antes de confirmar um massivo.',
        ],
      },
      {
        eyebrow: 'QUESTÃO 2',
        title: 'É permitido informar uma previsão aproximada criada pelo atendente?',
        paragraphs: [
          'Resposta esperada: não. Somente a estimativa oficialmente publicada pode ser informada, sempre como previsão e não como garantia.',
        ],
        tone: 'warning',
      },
      {
        eyebrow: 'QUESTÃO 3',
        title: 'Quais dados tornam um acionamento útil para o NOC?',
        paragraphs: [
          'Resposta esperada: região, estrutura quando disponível, sintoma, horário, exemplos de clientes e indicadores já consultados.',
        ],
        tone: 'info',
      },
      {
        eyebrow: 'QUESTÃO 4',
        title: 'O que precisa ficar registrado no atendimento?',
        paragraphs: [
          'Resposta esperada: sintoma, validação da abrangência, ocorrência relacionada, orientação transmitida e status no encerramento.',
        ],
      },
    ],
    checklist: [
      'Sei diferenciar massivo de falha individual.',
      'Sei validar alertas e abrangência.',
      'Sei comunicar previsão corretamente.',
      'Sei acionar o NOC com evidências.',
      'Sei registrar e encerrar o atendimento.',
    ],
    takeaways: [
      'Confirme antes de comunicar.',
      'Use informações oficiais.',
      'Registre de forma clara e profissional.',
    ],
    knowledgeCheck: {
      question: 'Qual princípio resume todo o curso?',
      answer:
        'Correlacionar evidências, confirmar a ocorrência e comunicar somente informações oficiais.',
    },
  },
};

const acessoExternoDispositivosContent = {
  summary:
    'Orientação para atendimento quando o cliente deseja acessar um dispositivo de fora da rede.',
  objectives: [
    'Identificar as perguntas essenciais antes de prometer acesso externo.',
    'Explicar quando IPv4 público, DDNS, portas e gateway são necessários.',
    'Padronizar a resposta ao cliente e os cuidados internos do atendimento.',
  ],
  sections: [
    {
      eyebrow: 'TRIAGEM',
      title: 'O que verificar primeiro',
      paragraphs: [
        'Antes de informar se é possível realizar o acesso externo, precisamos entender como está montada a rede do cliente.',
        'Perguntas que devem ser feitas:',
      ],
      bullets: [
        'O cliente possui roteador/gateway próprio no local?',
        'Qual é a marca e modelo desse equipamento?',
        'O dispositivo que deseja acessar está ligado nesse roteador/gateway?',
        'O equipamento aceita configuração PPPoE?',
        'Qual dispositivo será acessado externamente: câmera, DVR/NVR, servidor, sistema interno, automação ou outro equipamento?',
        'O cliente sabe qual porta ou sistema será usado para acesso?',
      ],
    },
    {
      eyebrow: 'IPV4',
      title: 'IPv4 serve?',
      paragraphs: [
        'Sim, IPv4 serve, desde que seja um IPv4 público.',
        'O IP não precisa obrigatoriamente ser fixo. Se for um IPv4 público dinâmico, o cliente pode usar DDNS, como No-IP, DuckDNS ou serviço semelhante.',
        'Porém, se o cliente estiver em CGNAT, o redirecionamento de portas não funcionará para acesso externo direto.',
      ],
      tone: 'warning',
    },
    {
      eyebrow: 'REQUISITOS',
      title: 'O que é necessário para funcionar',
      paragraphs: [
        'Para acesso externo tradicional, normalmente é necessário:',
        'Exemplo: Internet → Roteador/Gateway do cliente → Dispositivo interno.',
      ],
      bullets: [
        'Roteador/gateway no local;',
        'IPv4 público;',
        'Redirecionamento de portas;',
        'Firewall liberado;',
        'Dispositivo configurado corretamente;',
        'DDNS, caso o IP seja dinâmico.',
      ],
    },
    {
      eyebrow: 'GATEWAY',
      title: 'E se o cliente não tiver gateway?',
      paragraphs: [
        'Se o cliente não tiver um roteador/gateway próprio, não terá onde configurar NAT, redirecionamento de portas ou controle adequado da rede.',
        'Nesse caso, é necessário avaliar:',
      ],
      bullets: [
        'Instalação ou configuração de um gateway;',
        'Equipamento que aceite PPPoE;',
        'Solução semi-dedicada;',
        'Link dedicado;',
        'VPN ou solução em nuvem, dependendo do dispositivo.',
      ],
      tone: 'info',
    },
    {
      eyebrow: 'COMERCIAL',
      title: 'Solução comercial',
      paragraphs: [
        'Caso o cliente precise de acesso externo com IP público, podemos avaliar uma solução semi-dedicada ou dedicada.',
        'Para link dedicado, o mínimo comercial é: 100 Megas.',
      ],
    },
    {
      eyebrow: 'RESPOSTA PRONTA',
      title: 'Resposta pronta para o cliente',
      paragraphs: [
        'Para verificarmos a possibilidade de acesso externo ao seu dispositivo, precisamos confirmar algumas informações sobre a sua rede.',
        'Você possui um roteador ou gateway próprio no local? Se sim, poderia nos informar a marca e o modelo do equipamento?',
        'Também precisamos verificar se esse equipamento aceita configuração PPPoE, pois o acesso externo depende da forma como a conexão chega até sua rede e de como o roteador trata as portas e o NAT.',
        'Caso seja necessário IP público, podemos avaliar uma solução semi-dedicada ou dedicada. Para link dedicado, o plano mínimo é de 100 Megas.',
      ],
      tone: 'info',
    },
    {
      eyebrow: 'ATENÇÃO INTERNA',
      title: 'Observação interna',
      paragraphs: [
        'Não prometer acesso externo antes de confirmar:',
      ],
      bullets: [
        'Se existe gateway;',
        'Marca/modelo do equipamento;',
        'Se aceita PPPoE;',
        'Se o cliente possui IPv4 público ou está em CGNAT;',
        'Qual dispositivo será acessado;',
        'Se será necessário semi-dedicado ou dedicado.',
      ],
      tone: 'warning',
    },
  ],
  example: {
    title: 'Fluxo visual simples',
    scenario: 'Internet → Roteador/Gateway do cliente → Dispositivo interno',
    response:
      'Sem gateway próprio ou sem IPv4 público, avaliar PPPoE, semi-dedicado, dedicado, VPN ou solução em nuvem, conforme o dispositivo.',
  },
  checklist: [
    'Confirmar se existe roteador/gateway próprio.',
    'Anotar marca e modelo do equipamento.',
    'Confirmar se o equipamento aceita PPPoE.',
    'Verificar se o cliente possui IPv4 público ou está em CGNAT.',
    'Identificar qual dispositivo e qual porta/sistema serão usados.',
    'Avaliar se será necessário semi-dedicado, dedicado, VPN ou nuvem.',
  ],
  takeaways: [
    'IPv4 serve somente quando é público.',
    'IP dinâmico pode funcionar com DDNS.',
    'CGNAT impede redirecionamento de portas para acesso externo direto.',
    'Link dedicado tem mínimo comercial de 100 Megas.',
  ],
  knowledgeCheck: {
    question: 'Antes de prometer acesso externo, o que precisa ser confirmado?',
    answer:
      'Gateway, marca/modelo, PPPoE, IPv4 público ou CGNAT, dispositivo acessado, porta/sistema utilizado e necessidade de semi-dedicado ou dedicado.',
  },
};

const createGenericLessonContent = ({ course, module, lesson }) => ({
  summary:
    `Nesta aula de ${course.title}, você vai revisar ${lesson.title.toLowerCase()} e entender como aplicar o conteúdo na rotina da equipe.`,
  objectives: [
    `Compreender os pontos essenciais de ${lesson.title.toLowerCase()}.`,
    `Relacionar o conteúdo ao módulo ${module.title}.`,
    'Aplicar uma sequência clara de análise, ação e registro.',
  ],
  sections: [
    {
      eyebrow: 'CONTEXTO',
      title: `Por que estudar ${lesson.title.toLowerCase()}`,
      paragraphs: [
        `${module.description} Esta etapa organiza os conceitos que a equipe precisa consultar antes de tomar uma decisão.`,
      ],
    },
    {
      eyebrow: 'APLICAÇÃO',
      title: 'Leve o conteúdo para a rotina',
      bullets: [
        'Confirme as informações disponíveis antes de agir.',
        'Siga o procedimento definido para a área.',
        'Comunique o próximo passo com clareza.',
        'Registre as informações necessárias para continuidade.',
      ],
      tone: 'info',
    },
    {
      eyebrow: 'BOA PRÁTICA',
      title: 'Priorize consistência',
      paragraphs: [
        'Use esta aula como referência e ajuste a aplicação ao cenário real. Quando houver dúvida operacional, valide com a liderança ou com a área responsável.',
      ],
      tone: 'warning',
    },
  ],
  checklist: [
    'Contexto compreendido.',
    'Procedimento correto identificado.',
    'Próxima ação definida.',
    'Comunicação revisada.',
    'Registro preparado.',
  ],
  takeaways: [
    'Use informações confirmadas.',
    'Siga o fluxo da área.',
    'Mantenha comunicação e registro consistentes.',
  ],
});

export const getWikiLessonContent = ({ course, module, lesson }) => {
  if (course.defaultLessonContent) {
    return course.defaultLessonContent;
  }

  if (course.slug === 'acesso-externo-dispositivos') {
    return acessoExternoDispositivosContent;
  }

  if (course.slug === 'massivos' && massivosLessonContent[lesson.contentKey || lesson.slug]) {
    return massivosLessonContent[lesson.contentKey || lesson.slug];
  }

  return createGenericLessonContent({ course, module, lesson });
};

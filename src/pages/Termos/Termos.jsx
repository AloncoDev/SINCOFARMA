import { Link } from "react-router-dom";
import {
  Ban,
  Building2,
  ClipboardCheck,
  FileText,
  History,
  KeyRound,
  Lock,
  PowerOff,
  ServerCog,
  Info,
} from "lucide-react";
import { PRIVACIDADE, TERMOS, IDLE_MINUTES } from "../../config/app";
import { PolicyPage, PolicySection } from "../Privacidade/PolicyPage";

/**
 * Termos de uso do painel: aberto sem login, linkado no login, em "Minha conta" e na
 * política de privacidade. O texto acompanha o que o sistema faz de verdade (perfis,
 * duas etapas, inatividade, auditoria); mudou o comportamento? Atualize aqui e a data.
 */
export default function Termos() {
  return (
    <PolicyPage
      crumb="Termos de uso"
      title="Termos de uso"
      lead="As regras para usar o Painel Clínico Sincofarma DF."
      updated={TERMOS.atualizadosEm}
      updatedLabel="Atualizados em"
      outra={{ to: "/privacidade", label: "Política de privacidade" }}
      banner={
        <>
          <ClipboardCheck size={18} aria-hidden="true" />
          <span>
            <b>Em resumo:</b> a conta é pessoal, o que você registra é responsabilidade profissional sua e todo
            acesso fica registrado. No primeiro acesso, e quando estes termos mudam, o painel pede o seu aceite e
            registra a data.
          </span>
        </>
      }
    >
      <PolicySection id="painel" icon={Building2} title="O que é o painel" hint="Quem oferece e para quê." index={4}>
        <p>
          O Painel Clínico é oferecido pelo <b>{PRIVACIDADE.sincofarma}</b> às farmácias associadas, para registrar o
          atendimento farmacêutico, classificar o risco, entregar ao paciente a declaração de serviço farmacêutico e
          encaminhar casos às unidades de saúde da rede pública, com guia de encaminhamento.
        </p>
        <p className="policy-note">
          <Info size={15} aria-hidden="true" /> O painel apoia a decisão do profissional de saúde; não a substitui nem
          dispensa a avaliação médica quando ela for necessária. A classificação de risco serve para decidir a urgência
          do encaminhamento e não é diagnóstico.
        </p>
      </PolicySection>

      <PolicySection id="acesso" icon={KeyRound} title="Quem pode usar" hint="Contas, login e computadores compartilhados." index={5}>
        <ul className="policy-checks">
          <li>Farmacêuticos das farmácias associadas, médicos cadastrados e a administração do Sincofarma.</li>
          <li>A conta é criada pela administração, é pessoal e não pode ser emprestada ou compartilhada.</li>
          <li>O login exige senha e verificação em duas etapas pelo app autenticador.</li>
          <li>
            Em computador de balcão, saia ao terminar. A sessão encerra sozinha depois de {IDLE_MINUTES} minutos sem
            atividade. Só marque "confiar neste computador" em aparelho da sua farmácia.
          </li>
        </ul>
      </PolicySection>

      <PolicySection
        id="responsabilidades"
        icon={ClipboardCheck}
        title="Suas responsabilidades"
        hint="O que se espera de quem registra e consulta atendimentos."
        wide
        index={6}
      >
        <div className="policy-split">
          <div className="policy-box">
            <h3>Ao registrar</h3>
            <ul>
              <li>Informar dados verdadeiros e completos sobre o paciente e o atendimento.</li>
              <li>Atender paciente menor de 18 anos só com o responsável legal presente, e registrá-lo.</li>
              <li>Entregar ao paciente a declaração de serviço farmacêutico (RDC 44/2009) e arquivar a 2ª via assinada.</li>
              <li>Antes de encaminhar, explicar ao paciente para onde ele vai e que a guia pode ser consultada pelas unidades de saúde da rede.</li>
              <li>
                Responder, conforme as normas do seu conselho profissional, pelas condutas, orientações e
                encaminhamentos que registrar.
              </li>
              <li>Corrigir o desfecho pelo próprio painel assim que perceber um erro e avisar a administração de qualquer outro erro no registro.</li>
            </ul>
          </div>
          <div className="policy-box">
            <h3>Ao consultar</h3>
            <ul>
              <li>Abrir só os atendimentos dos pacientes que você atende ou que foram encaminhados a você.</li>
              <li>Usar os dados só para o atendimento, sem copiar, fotografar ou repassar fora dessa finalidade.</li>
              <li>Avisar a administração do Sincofarma se suspeitar que alguém usou a sua conta.</li>
            </ul>
          </div>
        </div>
      </PolicySection>

      <PolicySection id="proibido" icon={Ban} title="O que não é permitido" hint="Usos que levam ao bloqueio da conta." index={7}>
        <ul className="policy-rows">
          <li><b>Acessar dados de outra farmácia</b><span>ou tentar ver o que o seu perfil não permite.</span></li>
          <li><b>Burlar a segurança</b><span>do painel, da verificação em duas etapas ou da auditoria.</span></li>
          <li><b>Automatizar o acesso</b><span>com robôs ou programas que extraiam dados.</span></li>
          <li><b>Uso comercial</b><span>dos dados de pacientes, inclusive publicidade.</span></li>
        </ul>
      </PolicySection>

      <PolicySection id="auditoria" icon={History} title="Registro de acessos" hint="O que fica gravado sobre o uso." index={8}>
        <p>
          O painel registra quem abriu cada ficha, quem registrou ou alterou cada atendimento e quando. A administração do
          Sincofarma consulta esses registros para segurança e para apurar usos indevidos.
        </p>
      </PolicySection>

      <PolicySection id="disponibilidade" icon={ServerCog} title="Disponibilidade" hint="Quando o painel pode ficar fora do ar." index={9}>
        <p>
          O painel fica disponível pela internet e pode passar por manutenções ou falhas. O atendimento ao paciente não
          deve esperar pelo painel: registre assim que ele voltar.
        </p>
      </PolicySection>

      <PolicySection id="encerramento" icon={PowerOff} title="Suspensão e encerramento" hint="Quando o acesso é desativado." index={10}>
        <p>
          A administração do Sincofarma desativa o acesso quando termina o vínculo com a farmácia ou quando estes termos
          não são cumpridos. Os atendimentos registrados continuam guardados por {PRIVACIDADE.retencaoAnos} anos, o prazo
          do prontuário de saúde.
        </p>
      </PolicySection>

      <PolicySection id="privacidade" icon={Lock} title="Privacidade" hint="Como os dados são tratados." index={11}>
        <p>
          O tratamento dos dados de quem usa o painel e dos pacientes está na{" "}
          <Link to="/privacidade">política de privacidade</Link>, que faz parte destes termos.
        </p>
      </PolicySection>

      <PolicySection id="alteracoes" icon={FileText} title="Mudanças e foro" hint="Novas versões e onde resolver conflitos." wide index={12}>
        <p>
          Estes termos podem mudar quando o painel ou as normas mudarem. A data no topo indica a versão em vigor.
          Vale a lei brasileira, e fica eleito o foro de Brasília (DF).
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

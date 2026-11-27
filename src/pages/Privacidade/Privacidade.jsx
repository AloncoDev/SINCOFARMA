import {
  Building2,
  Database,
  Scale,
  Share2,
  Clock,
  Lock,
  UserCheck,
  Monitor,
  ShieldCheck,
  Info,
} from "lucide-react";
import { PRIVACIDADE } from "../../config/app";
import { PolicyPage, PolicySection } from "./PolicyPage";

const SECTIONS = {
  controlador: { icon: Building2, hint: "Controladores, operador e encarregado de dados." },
  dados: { icon: Database, hint: "O que fica registrado, de quem usa o painel e de pacientes.", wide: true },
  bases: { icon: Scale, hint: "Por que cada dado é tratado." },
  compartilhamento: { icon: Share2, hint: "Quem mais recebe os dados." },
  retencao: { icon: Clock, hint: "Prazos de guarda." },
  seguranca: { icon: Lock, hint: "Medidas técnicas e de acesso." },
  direitos: { icon: UserCheck, hint: "Como pedir acesso, cópia, correção ou exclusão.", wide: true },
  navegador: { icon: Monitor, hint: "O que o painel guarda no seu aparelho." },
};

function Section({ id, ...props }) {
  return <PolicySection id={id} {...SECTIONS[id]} {...props} />;
}

/**
 * Política de privacidade do painel (LGPD, art. 9º): aberta sem login, linkada no
 * login e em "Minha conta". Mesmo visual das telas internas (fundo claro, trilha,
 * cartões). O texto acompanha o que o sistema faz de verdade; mudou o tratamento
 * (novo dado, novo compartilhamento, outro prazo)? Atualize aqui e a data.
 */
export default function Privacidade() {
  const { encarregado } = PRIVACIDADE;

  return (
    <PolicyPage
      crumb="Privacidade"
      title="Política de privacidade"
      lead="Como o painel clínico trata os seus dados, conforme a LGPD (Lei 13.709/2018)."
      updated={PRIVACIDADE.atualizadaEm}
      outra={{ to: "/termos", label: "Termos de uso" }}
      banner={
        <>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <b>Em resumo:</b> os dados não são vendidos nem usados para publicidade, ficam criptografados no Brasil
            e o painel não usa cookies de rastreamento.
          </span>
        </>
      }
    >
      <Section id="controlador" title="Quem cuida dos dados" index={4}>
        <ul className="policy-rows">
          <li>
            <b>Dados dos pacientes</b>
            <span>
              A <b>farmácia</b> que fez o atendimento é a controladora: decide e responde pelo atendimento e pelo
              registro. O <b>{PRIVACIDADE.sincofarma}</b> fornece o painel às farmácias e trata esses dados só por conta
              delas e para essa finalidade (operador).
            </span>
          </li>
          <li>
            <b>Dados de quem usa o painel</b>
            <span>O controlador é o {PRIVACIDADE.sincofarma}, que cria e administra as contas de acesso.</span>
          </li>
        </ul>
        <div className="policy-callout">
          <b>Encarregado de dados (DPO)</b>
          <span>
            {encarregado.nome ? (
              <>
                {encarregado.nome}
                {encarregado.email && (
                  <> · <a href={`mailto:${encarregado.email}`}>{encarregado.email}</a></>
                )}
              </>
            ) : (
              "A ser nomeado pelo Sincofarma DF. Enquanto isso, fale com a farmácia ou com a administração do Sincofarma."
            )}
          </span>
        </div>
      </Section>

      <Section id="dados" title="Que dados o painel guarda" index={5}>
        <div className="policy-split">
          <div className="policy-box">
            <h3>De quem usa o painel</h3>
            <small>Farmacêuticos, médicos e administração</small>
            <ul>
              <li>Nome, CPF (usado como login), e-mail, CRF e farmácia em que trabalha.</li>
              <li>Senha (guardada só como código irreversível) e o app autenticador da verificação em duas etapas.</li>
              <li>Aparelhos marcados como confiáveis por 24 horas.</li>
              <li>O que fez no painel e quando: atendimentos registrados, fichas abertas, encaminhamentos, alterações.</li>
              <li>Aceite dos termos de uso (versão e data).</li>
              <li>Registros técnicos de acesso, com endereço IP.</li>
            </ul>
          </div>
          <div className="policy-box">
            <h3>De pacientes</h3>
            <small>Atendidos nas farmácias</small>
            <ul>
              <li>Identificação: nome, CPF, Cartão Nacional de Saúde (opcional), data de nascimento, sexo e telefone.</li>
              <li>Paciente menor de 18 anos: nome, CPF e parentesco do responsável legal que o acompanha.</li>
              <li>
                <b>Dados de saúde (sensíveis):</b> queixa, histórico (alergias, doenças, medicamentos), sinais
                vitais, classificação de risco, sinais de alerta, orientação farmacêutica, observações e o desfecho do
                atendimento.
              </li>
              <li>Encaminhamentos a unidades de saúde (UBS, UPA, hospitais), com o motivo, a guia de encaminhamento e a resposta do médico.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="bases" title="Para que e com qual base legal" index={6}>
        <dl className="policy-defs">
          <div>
            <dt>Atendimento farmacêutico, triagem e encaminhamento</dt>
            <dd>Tutela da saúde, por profissionais de saúde.</dd>
            <dd className="policy-law">LGPD, art. 7º, VIII, e art. 11, II, f</dd>
          </div>
          <div>
            <dt>Registro e guarda dos atendimentos e da responsabilidade técnica</dt>
            <dd>Cumprimento de obrigação legal e regulatória.</dd>
            <dd className="policy-law">art. 7º, II, e art. 11, II, a</dd>
          </div>
          <div>
            <dt>Crianças e adolescentes</dt>
            <dd>No melhor interesse deles, só com o responsável legal presente, que fica registrado.</dd>
            <dd className="policy-law">art. 14</dd>
          </div>
          <div>
            <dt>Contas de acesso, segurança e auditoria</dt>
            <dd>Execução do vínculo profissional e obrigação legal de segurança.</dd>
            <dd className="policy-law">art. 7º, II e V, e art. 46</dd>
          </div>
        </dl>
      </Section>

      <Section id="compartilhamento" title="Com quem os dados são compartilhados" index={7}>
        <ul className="policy-rows">
          <li>
            <b>Unidades de saúde da rede pública (UBS, UPA, hospitais)</b>
            <span>
              Quando o farmacêutico encaminha o atendimento, os médicos da unidade de destino recebem uma cópia da ficha.
              Médicos de outras unidades consultam a guia quando o paciente a apresenta (pelo código, QR code ou CPF).
              O farmacêutico explica isso ao paciente antes de encaminhar, e a guia impressa também avisa. Cada consulta
              fica registrada.
            </span>
          </li>
          <li>
            <b>Amazon Web Services (São Paulo)</b>
            <span>Hospedagem, banco de dados e login, com criptografia e chave própria do Sincofarma.</span>
          </li>
          <li><b>Vercel</b><span>Hospedagem das telas do painel; não guarda dados de pacientes.</span></li>
        </ul>
        <p className="policy-note"><Info size={15} aria-hidden="true" /> A integração com a RNDS (Ministério da Saúde) ainda não está ativa; quando estiver, esta página será atualizada.</p>
      </Section>

      <Section id="retencao" title="Por quanto tempo" index={8}>
        <ul className="policy-rows">
          <li>
            <b>Fichas de atendimento e encaminhamentos</b>
            <span>
              {PRIVACIDADE.retencaoAnos} anos a partir do registro, o prazo do prontuário de saúde (Lei 13.787/2018). Depois
              disso, são apagados automaticamente, junto com o registro de quem mexeu neles.
            </span>
          </li>
          <li><b>Registro geral de auditoria</b><span>Sem dados de pacientes; enquanto o painel existir.</span></li>
          <li><b>Registros técnicos de acesso (com IP)</b><span>90 dias.</span></li>
          <li><b>Conta de acesso</b><span>Enquanto durar o vínculo; depois, é anonimizada a pedido.</span></li>
        </ul>
      </Section>

      <Section id="seguranca" title="Como protegemos" index={9}>
        <ul className="policy-checks">
          <li>Login com senha forte e verificação em duas etapas obrigatória.</li>
          <li>Dados criptografados, com chave própria; sessões que encerram sozinhas por inatividade.</li>
          <li>Cada perfil vê só o necessário: a administração vê números e quem cuidou de cada atendimento, sem nome, CPF ou queixa do paciente, e só exporta os dados de um paciente a pedido dele, com o pedido registrado; os médicos veem os encaminhamentos da unidade de saúde onde atendem e as guias que o paciente apresenta. Cada consulta fica registrada.</li>
          <li>Toda abertura de ficha e toda alteração ficam registradas com quem fez e quando.</li>
        </ul>
      </Section>

      <Section id="direitos" title="Seus direitos (art. 18)" index={10}>
        <p>
          Você pode confirmar se tratamos seus dados, ter acesso a eles, corrigi-los, saber com quem foram
          compartilhados, receber uma cópia e pedir a eliminação quando a lei permitir.
        </p>
        <div className="policy-split">
          <div className="policy-box">
            <h3>Se você usa o painel</h3>
            <p>
              Em <b>Minha conta → Privacidade e seus dados</b>: baixe um arquivo com tudo o que o painel guarda sobre
              você e peça correção ou exclusão da conta. A exclusão anonimiza a conta; os atendimentos que você
              registrou continuam guardados, como exige a norma sanitária.
            </p>
          </div>
          <div className="policy-box">
            <h3>Se você foi atendido numa farmácia</h3>
            <p>
              Peça na farmácia que o atendeu (ou à administração do Sincofarma, que ajuda a farmácia a responder), com
              documento. Entregamos uma cópia de todos os seus atendimentos e encaminhamentos, incluindo com quais unidades
              de saúde foram compartilhados e qual médico respondeu. Dados de saúde não podem ser apagados antes do prazo
              legal; pedidos de correção são avaliados pela farmácia que registrou o atendimento junto com a administração,
              e a correção fica registrada sem apagar o registro original. Pelo paciente menor de idade, pede o responsável
              legal.
            </p>
          </div>
        </div>
        <p className="policy-note"><Info size={15} aria-hidden="true" /> Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
      </Section>

      <Section id="navegador" title="Armazenamento no navegador" index={11}>
        <p>
          O painel não usa cookies de rastreamento nem de publicidade. Guarda no navegador só o necessário para
          funcionar: a sessão de login (apagada ao sair), a preferência de animações, o horário da última atividade
          (para encerrar por inatividade) e, se você marcar "confiar neste computador", a chave desse aparelho por 24 horas.
        </p>
      </Section>
    </PolicyPage>
  );
}

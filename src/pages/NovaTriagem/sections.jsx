// Seções do formulário. Cada uma recebe o estado e os manipuladores da página.
import { motion, AnimatePresence } from "framer-motion";
import { SPRING } from "../../utils/motion";
import Select from "../../components/Select";
import { Field, FieldGroup, Section, ChipField } from "./fields";
import { RISK_LEVELS, RED_FLAGS, CODE_SUGGESTIONS, OBS_LIMIT, GUIDANCE_LIMIT, RANGES, GUARDIAN_RELATIONS } from "./constants";
import { rangeMsg, paError, isMinor } from "./validation";

export function IdentificacaoSection({ form, on, bad }) {
  return (
    <Section id="tg-identificacao" n={1} title="Identificação do cidadão" subtitle="Dados básicos e documentos para abertura do atendimento">
      <div className="tg-grid tg-grid--3">
        <Field label="CPF" invalid={bad("cpf")} error="CPF inválido. Confira os 11 dígitos.">
          <input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={form.cpf}
            onChange={on.masked("cpf", "###.###.###-##")} />
        </Field>
        <Field label="Cartão SUS (CNS) · opcional" invalid={bad("cns")} error="Complete os 15 dígitos ou deixe em branco.">
          <input inputMode="numeric" placeholder="000 0000 0000 0000" value={form.cns} onChange={on.digits("cns", 15)} />
        </Field>
        <Field label="Nome completo" invalid={bad("nome")} error="Informe nome e sobrenome.">
          <input autoComplete="off" placeholder="Nome e sobrenome" value={form.nome} onChange={on.text("nome")} />
        </Field>
        <Field label="Data de nascimento" invalid={bad("nascimento")} error="Informe uma data válida (dd/mm/aaaa).">
          <input inputMode="numeric" placeholder="dd/mm/aaaa" value={form.nascimento}
            onChange={on.masked("nascimento", "##/##/####")} />
        </Field>
        <Field label="Sexo" invalid={bad("sexo")} error="Selecione o sexo.">
          <Select
            className="sel--bare"
            placeholder="Selecione uma opção"
            value={form.sexo}
            onChange={(v) => on.text("sexo")({ target: { value: v } })}
            options={[{ value: "F", label: "Feminino" }, { value: "M", label: "Masculino" }]}
          />
        </Field>
        <Field label="Telefone">
          <input type="tel" inputMode="numeric" placeholder="(61) 99999-0000" value={form.telefone}
            onChange={on.masked("telefone", "(##) #####-####")} />
        </Field>
      </div>
      <AnimatePresence initial={false}>
        {isMinor(form) && (
          <motion.div
            className="tg-guardian"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="tg-guardian-note" role="note">
              <b>Paciente menor de 18 anos.</b> Atenda só com o responsável legal presente e registre quem é.
            </p>
            <div className="tg-grid tg-grid--3">
              <Field label="Nome do responsável" invalid={bad("respNome")} error="Informe nome e sobrenome do responsável.">
                <input autoComplete="off" placeholder="Nome e sobrenome" value={form.respNome} onChange={on.text("respNome")} />
              </Field>
              <Field label="CPF do responsável" invalid={bad("respCpf")} error="CPF inválido ou igual ao do paciente.">
                <input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={form.respCpf}
                  onChange={on.masked("respCpf", "###.###.###-##")} />
              </Field>
              <Field label="Parentesco" invalid={bad("respParentesco")} error="Selecione o parentesco.">
                <Select
                  className="sel--bare"
                  placeholder="Selecione uma opção"
                  value={form.respParentesco}
                  onChange={(v) => on.text("respParentesco")({ target: { value: v } })}
                  options={GUARDIAN_RELATIONS}
                />
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

export function QueixaSection({ form, on, bad }) {
  return (
    <Section id="tg-queixa" n={2} title="Queixa principal" subtitle="Motivo informado pelo paciente">
      <div className="tg-grid">
        <Field label="Queixa principal" invalid={bad("queixa")} error="Descreva a queixa do paciente.">
          <input placeholder="Descreva a queixa relatada pelo paciente..." value={form.queixa} onChange={on.text("queixa")} />
        </Field>
        <div className="tg-grid tg-grid--2">
          {/* CIAP-2 classifica o motivo da procura na atenção primária; diagnóstico (CID) é do médico */}
          <Field label="Motivo (CIAP-2) · opcional">
            <input list="tg-codes" placeholder="Ex: CIAP-2 A03" value={form.codigo} onChange={on.text("codigo")} />
            <datalist id="tg-codes">
              {CODE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Início dos sintomas" invalid={bad("inicioSintomas")} error="Data inválida, futura ou anterior ao nascimento.">
            <input inputMode="numeric" placeholder="dd/mm/aaaa" value={form.inicioSintomas}
              onChange={on.masked("inicioSintomas", "##/##/####")} />
          </Field>
        </div>
      </div>
    </Section>
  );
}

export function HistoricoSection({ form, setField }) {
  return (
    <Section id="tg-historico" n={3} title="Histórico clínico" subtitle="Informações relevantes do atendimento">
      <div className="tg-grid">
        <div className="tg-grid tg-grid--2">
          <ChipField label="Alergia medicamentosa" placeholder="Pesquisar / adicionar..."
            items={form.alergias} onChange={(v) => setField("alergias", v)} />
          <ChipField label="Comorbidade" placeholder="Pesquisar / adicionar..."
            items={form.comorbidades} onChange={(v) => setField("comorbidades", v)} />
        </div>
        <ChipField label="Medicamento em uso" placeholder="Adicionar medicamento..."
          items={form.medicamentos} onChange={(v) => setField("medicamentos", v)} />
      </div>
    </Section>
  );
}

function Vital({ label, field, unit, placeholder, form, on, bad, decimal = false, max = 3 }) {
  return (
    <Field label={label} invalid={bad(field)} error={rangeMsg(label === "Frequência cardíaca" ? "FC" : label, RANGES[field], unit)} className="tg-vital">
      <input inputMode={decimal ? "decimal" : "numeric"} placeholder={placeholder} value={form[field]}
        onChange={decimal ? on.decimal(field) : on.digits(field, max)} />
      <span className="tg-unit">{unit}</span>
    </Field>
  );
}

export function SinaisSection({ form, on, bad, imc }) {
  const p = { form, on, bad };
  return (
    <Section id="tg-sinais" n={4} title="Sinais vitais e medidas" subtitle="Aferições realizadas durante o acolhimento farmacêutico">
      <div className="tg-grid tg-grid--3">
        <FieldGroup label="Pressão arterial" invalid={bad("paSis") || bad("paDia")} error={paError(form)} className="tg-vital">
          <span className="tg-pa">
            <input inputMode="numeric" placeholder="120" aria-label="Pressão sistólica (mmHg)"
              aria-invalid={bad("paSis") || undefined} value={form.paSis} onChange={on.digits("paSis", 3)} />
            <span aria-hidden="true">/</span>
            <input inputMode="numeric" placeholder="80" aria-label="Pressão diastólica (mmHg)"
              aria-invalid={bad("paDia") || undefined} value={form.paDia} onChange={on.digits("paDia", 3)} />
          </span>
          <span className="tg-unit">mmHg</span>
        </FieldGroup>
        <Vital {...p} label="Frequência cardíaca" field="fc" unit="bpm" placeholder="72" />
        <Vital {...p} label="SpO2" field="spo2" unit="%" placeholder="98" />
        <Vital {...p} label="Temperatura" field="temp" unit="°C" placeholder="36,5" decimal />
        <Vital {...p} label="Peso" field="peso" unit="kg" placeholder="70" decimal />
        <Vital {...p} label="Altura" field="altura" unit="cm" placeholder="170" />
        <div className="tg-field tg-vital tg-col-all">
          <span className="tg-label" id="tg-imc-label">IMC</span>
          <output className="tg-imc" aria-labelledby="tg-imc-label" aria-live="polite">{imc ?? "–"}</output>
          <span className="tg-unit">kg/m²</span>
        </div>
      </div>
    </Section>
  );
}

export function RiscoSection({ form, on, bad, toggleFlag }) {
  const invalid = bad("risco");
  return (
    <Section
      id="tg-triagem"
      n={5}
      title="Classificação de risco"
      subtitle="Apoio ao acolhimento farmacêutico para decidir a urgência do encaminhamento. Não substitui a avaliação médica."
    >
      <fieldset className="tg-risk" aria-describedby={invalid ? "tg-risk-err" : undefined}>
        <legend className="sr-only">Classificação de risco</legend>
        {RISK_LEVELS.map((r) => (
          <label key={r.id} className={`tg-risk-option tg-risk-option--${r.id}`}>
            <input type="radio" name="risco" value={r.id} checked={form.risco === r.id}
              onChange={on.text("risco")} aria-describedby={`tg-risk-hint-${r.id}`} />
            <motion.span
              className="tg-risk-card"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              animate={form.risco === r.id ? { scale: 1.03 } : { scale: 1 }}
              transition={SPRING}
            >
              <span className="tg-risk-name"><i className="tg-dot" aria-hidden="true" />{r.label}</span>
              <span className="tg-risk-hint" id={`tg-risk-hint-${r.id}`}>{r.hint}</span>
            </motion.span>
          </label>
        ))}
      </fieldset>
      <AnimatePresence>
        {invalid && (
          <motion.p
            id="tg-risk-err"
            className="tg-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            Selecione uma classificação de risco.
          </motion.p>
        )}
      </AnimatePresence>

      <div className="tg-field tg-flags" role="group" aria-labelledby="tg-flags-label">
        <span id="tg-flags-label" className="tg-label">Red flags detectadas</span>
        {RED_FLAGS.map((flag) => (
          <label key={flag} className="tg-check">
            <input type="checkbox" checked={form.redFlags.includes(flag)} onChange={() => toggleFlag(flag)} />
            {flag}
          </label>
        ))}
      </div>
    </Section>
  );
}

export function ObservacaoSection({ form, on }) {
  return (
    <Section id="tg-observacao" n={6} title="Orientação e observação" subtitle="O que foi orientado ao paciente e registro interno do farmacêutico">
      <Field label="Orientação farmacêutica (vai na declaração entregue ao paciente)">
        <textarea rows={3} maxLength={GUIDANCE_LIMIT} value={form.orientacao} onChange={on.text("orientacao")}
          placeholder="Ex.: medir a pressão de novo em 7 dias; procurar a UBS se a dor piorar..." />
      </Field>
      <p className="tg-counter" aria-live="polite">{form.orientacao.length} / {GUIDANCE_LIMIT} caracteres</p>
      <Field label="Observações internas (não vão para o paciente)">
        <textarea rows={3} maxLength={OBS_LIMIT} value={form.observacoes} onChange={on.text("observacoes")}
          placeholder="Digite informações adicionais, evolução ou observações..." />
      </Field>
      <p className="tg-counter" aria-live="polite">{form.observacoes.length} / {OBS_LIMIT} caracteres</p>
    </Section>
  );
}

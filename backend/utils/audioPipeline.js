// VERSION: v1.0.0 | DATE: 2026-04-08 | AUTHOR: VeloHub Development Team
// Pipeline de áudio Qualidade: valores canônicos pending | done | failed (legado: boolean).

const AUDIO_PIPELINE = {
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed'
};

function isAudioPipelineDone(t) {
  return t === true || t === AUDIO_PIPELINE.DONE;
}

function isAudioPipelineFailed(t) {
  return t === AUDIO_PIPELINE.FAILED;
}

/** Pendente de processamento (inclui legado sent + boolean false). */
function isAudioPipelinePending(t, audioSent) {
  if (audioSent !== true) return false;
  if (isAudioPipelineDone(t)) return false;
  if (isAudioPipelineFailed(t)) return false;
  return (
    t === AUDIO_PIPELINE.PENDING ||
    t === false ||
    t == null ||
    t === ''
  );
}

/** Bloqueia novo generate-upload-url: enviado e ainda não concluído (inclui failed). */
function isAudioUploadBlocked(avaliacao) {
  if (!avaliacao || avaliacao.audioSent !== true) return false;
  return !isAudioPipelineDone(avaliacao.audioTreated);
}

/**
 * Reenvio manual permitido após falha e janela audioManualReenvioDisponivelEm.
 */
function isManualRepublishAllowed(avaliacao) {
  if (!avaliacao || avaliacao.audioSent !== true) return false;
  if (!isAudioPipelineFailed(avaliacao.audioTreated)) return false;
  const unlock = avaliacao.audioManualReenvioDisponivelEm;
  if (!unlock) return true;
  return Date.now() >= new Date(unlock).getTime();
}

module.exports = {
  AUDIO_PIPELINE,
  isAudioPipelineDone,
  isAudioPipelineFailed,
  isAudioPipelinePending,
  isAudioUploadBlocked,
  isManualRepublishAllowed
};

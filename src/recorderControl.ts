// Not put into recorder.ts to prevent circular dependency
let _recorderPaused = false;
export const pauseRecorder = () => (_recorderPaused = true);
export const resumeRecorder = () => (_recorderPaused = false);
export const recorderPaused = () => _recorderPaused;

let _globalRecordingDisabled = false;
export const disableGlobalRecording = () => (_globalRecordingDisabled = true);
export const enableGlobalRecording = () => (_globalRecordingDisabled = false);
export const globalRecordingDisabled = () => _globalRecordingDisabled;

let _codeBlockRecordingActive = false;
export const setCodeBlockRecordingActive = () => (_codeBlockRecordingActive = true);
export const unsetCodeBlockRecordingActive = () => (_codeBlockRecordingActive = false);
export const codeBlockRecordingActive = () => _codeBlockRecordingActive;

export const shouldRecord = () =>
  !recorderPaused() && (!globalRecordingDisabled() || codeBlockRecordingActive());

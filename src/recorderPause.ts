// Not put into recorder.ts to prevent circular dependency
let _recorderPaused = false;
export const pauseRecorder = () => (_recorderPaused = true);
export const resumeRecorder = () => (_recorderPaused = false);
export const recorderPaused = () => _recorderPaused;

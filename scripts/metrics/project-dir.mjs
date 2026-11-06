/**
 * Name of the folder where Claude Code keeps the session logs of a project:
 * the project path with every character that is not a letter or a digit replaced by `-`.
 *
 * @param {string} projectPath
 */
export function projectDirName(projectPath) {
  return projectPath.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * @xrmforge/devkit - Scaffold Types
 */

/** Configuration for project scaffolding */
export interface ScaffoldConfig {
  /** Absolute path to the target directory */
  targetDir: string;
  /** Project name for package.json (e.g. "my-d365-scripts") */
  projectName: string;
  /** Publisher prefix for D365 WebResources (e.g. "contoso") */
  prefix: string;
  /** Base namespace for form scripts (e.g. "Contoso") */
  namespace: string;
}

/** Result of scaffolding a project */
export interface ScaffoldResult {
  /** Relative paths of all created files */
  filesCreated: string[];
  /** Warnings (e.g. directory not empty) */
  warnings: string[];
}

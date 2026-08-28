import type { Plugin } from "@arunaki/plugin";
/**
 * Normalize an instance URL to `protocol//host`, falling back to the default
 * (GITLAB_INSTANCE_URL env or gitlab.com) when the value is empty/undefined.
 * Throws if a non-empty value is not a valid URL.
 */
export declare function normalizeOptionalInstanceUrl(value?: string): string;
/**
 * Validate an instance URL entered in an auth prompt. An empty value is allowed
 * (it defaults to gitlab.com / GITLAB_INSTANCE_URL); a non-empty value must be a
 * valid http(s) URL.
 */
export declare function validateInstanceUrl(value: string): string | undefined;
/**
 * OpenCode GitLab Auth Plugin
 */
export declare const gitlabAuthPlugin: Plugin;
export default gitlabAuthPlugin;
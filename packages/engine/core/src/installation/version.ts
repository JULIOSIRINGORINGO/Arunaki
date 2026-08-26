declare global {
  const Arunaki_VERSION: string
  const Arunaki_CHANNEL: string
}

export const InstallationVersion = typeof Arunaki_VERSION === "string" ? Arunaki_VERSION : "local"
export const InstallationChannel = typeof Arunaki_CHANNEL === "string" ? Arunaki_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

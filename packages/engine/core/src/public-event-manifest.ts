export * as PublicEventManifest from "./public-event-manifest"

import { Event } from "@arunaki/schema/event"
import { EventManifest } from "@arunaki/schema/event-manifest"

export const Definitions = EventManifest.ServerDefinitions
export const Latest = Event.latest(Definitions)

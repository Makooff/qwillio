/**
 * In-memory bot activity tracker — stores recent real actions for dashboard display
 */

export interface BotAction {
  message: string;
  timestamp: string;
}

const MAX_ACTIONS = 30;
let actions: BotAction[] = [];

export function trackAction(message: string) {
  actions.unshift({ message, timestamp: new Date().toISOString() });
  if (actions.length > MAX_ACTIONS) actions.length = MAX_ACTIONS;
}

export function getLastAction(): BotAction | null {
  return actions[0] || null;
}

export function getRecentActions(limit = 10): BotAction[] {
  return actions.slice(0, limit);
}

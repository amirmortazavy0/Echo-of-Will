import type { ParsedLogProposal } from '../src/types';
const enums = {
  node_status: ['ACTIVE', 'COMPLETE', 'PLANNED', 'PAUSED'],
  work_type: ['UNKNOWN', 'DEVELOPMENT', 'RESEARCH', 'DESIGN', 'WRITING', 'ADMIN'],
  energy: ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'], focus: ['UNKNOWN', 'SCATTERED', 'NORMAL', 'DEEP'],
  location: ['UNKNOWN', 'HOME', 'CAFE', 'OFFICE', 'TRANSIT', 'OTHER'], environment: ['UNKNOWN', 'QUIET', 'AMBIENT', 'NOISY'],
  entry_types: ['NOTE', 'DISCOVERY', 'INTENTION_REVISED', 'CONTEXT_SWITCH', 'TASK_STARTED', 'TASK_PAUSED', 'TASK_COMPLETED'],
};
const string = { type: 'string', maxLength: 12000 };
const properties = {
  journey_id: string, node_id: { type: ['string', 'null'] }, node_name: string,
  node_status: { type: 'string', enum: enums.node_status }, work_type: { type: 'string', enum: enums.work_type },
  duration_minutes: { type: ['integer', 'null'], minimum: 1, maximum: 10000000 },
  intention: { ...string, minLength: 1 }, summary: string, reasoning: string,
  condition: { type: 'object', additionalProperties: false, required: ['energy', 'focus', 'location', 'environment'],
    properties: Object.fromEntries(['energy', 'focus', 'location', 'environment'].map(key => [key, { type: 'string', enum: enums[key] }])) },
  entry_types: { type: 'array', minItems: 1, maxItems: 7, items: { type: 'string', enum: enums.entry_types } },
};
export const proposalSchema = { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
export function validateProposal(value: any, journeyId: string, nodes: { id: string; name: string }[]): Omit<ParsedLogProposal, 'provider'> {
  const fail = () => { throw new Error('Invalid model proposal'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  if (Object.keys(value).length !== Object.keys(properties).length || Object.keys(properties).some(key => !(key in value))) fail();
  for (const key of ['journey_id', 'node_name', 'intention', 'summary', 'reasoning']) if (typeof value[key] !== 'string' || value[key].length > 12000) fail();
  if (!value.intention.trim() || value.journey_id !== journeyId) fail();
  if (value.node_id !== null && !nodes.some(n => n.id === value.node_id && n.name === value.node_name)) fail();
  if (value.node_id === null && value.node_name !== '') fail();
  for (const key of ['node_status', 'work_type']) if (!enums[key].includes(value[key])) fail();
  if (value.duration_minutes !== null && (!Number.isSafeInteger(value.duration_minutes) || value.duration_minutes < 1 || value.duration_minutes > 10000000)) fail();
  if (!value.condition || typeof value.condition !== 'object' || Object.keys(value.condition).length !== 4) fail();
  for (const key of ['energy', 'focus', 'location', 'environment']) if (!enums[key].includes(value.condition[key])) fail();
  if (!Array.isArray(value.entry_types) || value.entry_types.length < 1 || value.entry_types.length > 7 || value.entry_types.some((t: unknown) => !enums.entry_types.includes(t as string))) fail();
  return value;
}

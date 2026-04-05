import { generateActionModule } from './dist/index.js';

// Das RequestFieldGovernanceBatch Action aus der echten Markant-Session
const requestFieldGov = {
  api: {
    uniquename: 'markant_RequestFieldGovernanceBatch',
    bindingtype: 0, // Global = unbound
    isfunction: false,
    boundentitylogicalname: null,
    displayname: 'Request Field Governance Batch',
    description: 'DYN-8248: Sets FG request code on a batch of contacts for RecomputeAll.',
  },
  requestParameters: [
    { uniquename: 'ContactIds', type: 10, isoptional: false, description: 'JSON array of Contact GUIDs max 200' },
    { uniquename: 'ResetFailed', type: 0, isoptional: true, description: 'Re-trigger Failed contacts' },
  ],
  responseProperties: [
    { uniquename: 'RequestedCount', type: 7 },
    { uniquename: 'Errors', type: 10 },
    { uniquename: 'SkippedCount', type: 7 },
    { uniquename: 'ErrorCount', type: 7 },
  ],
};

const output = generateActionModule([requestFieldGov], false);
console.log(output);

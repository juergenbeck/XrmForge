import { generateActionModule } from './dist/index.js';

const unboundActionWithParams = {
  api: {
    uniquename: 'markant_NormalizePhone',
    bindingtype: 0,
    isfunction: false,
    boundentitylogicalname: null,
    displayname: 'Normalize Phone',
    description: 'Normalisiert Telefonnummern',
  },
  requestParameters: [
    { uniquename: 'Input', type: 10, isoptional: false, description: 'Telefonnummer' },
    { uniquename: 'AllowSuspicious', type: 0, isoptional: true },
  ],
  responseProperties: [
    { uniquename: 'Normalized', type: 10 },
    { uniquename: 'Status', type: 7 },
    { uniquename: 'Message', type: 10 },
  ],
};

const output = generateActionModule([unboundActionWithParams], false);
console.log(output);

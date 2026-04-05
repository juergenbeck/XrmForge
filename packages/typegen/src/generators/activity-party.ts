/**
 * @xrmforge/typegen - ActivityParty Base Interface
 *
 * ActivityParty is a Dataverse system entity that represents participants
 * in activities (email, appointment, phonecall, fax, etc.).
 *
 * PartyList fields (to, from, cc, bcc, requiredattendees, optionalattendees)
 * are collection-valued navigation properties that return ActivityParty arrays.
 *
 * This interface is generated once and referenced by all Activity entities
 * that have PartyList fields.
 *
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/activityparty
 */

/**
 * Generate the ActivityParty base interface declaration.
 * This is a fixed structure (system entity, never customized).
 *
 * @returns TypeScript declaration string
 */
export function generateActivityPartyInterface(): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * Activity Party - Teilnehmer einer Aktivität (E-Mail, Termin, etc.)');
  lines.push(' * Wird von PartyList-Feldern (to, from, cc, bcc, requiredattendees) referenziert.');
  lines.push(' * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/activityparty');
  lines.push(' */');
  lines.push('export interface ActivityParty {');
  lines.push('  /** Primary key */');
  lines.push('  activitypartyid?: string;');
  lines.push('  /** Referenz auf die zugehörige Aktivität */');
  lines.push('  _activityid_value?: string;');
  lines.push('  /** Referenz auf den Teilnehmer (account | contact | systemuser | queue | knowledgearticle) */');
  lines.push('  _partyid_value?: string;');
  lines.push('  /**');
  lines.push('   * Rolle des Teilnehmers:');
  lines.push('   * 1=Sender, 2=To, 3=CC, 4=BCC, 5=Required Attendee,');
  lines.push('   * 6=Optional Attendee, 7=Organizer, 8=Regarding, 9=Owner,');
  lines.push('   * 10=Resource, 11=Customer, 12=Chat Participant, 13=Related');
  lines.push('   */');
  lines.push('  participationtypemask?: number;');
  lines.push('  /** E-Mail-Adresse für die Zustellung */');
  lines.push('  addressused?: string;');
  lines.push('  /** Aufwand des Teilnehmers (bei Serviceterminen) */');
  lines.push('  effort?: number;');
  lines.push('  /** Name des Teilnehmers (wenn nicht aufgelöst) */');
  lines.push('  unresolvedpartyname?: string;');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

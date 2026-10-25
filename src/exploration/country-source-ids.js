// ISO_A3 / ADM0_A3 aliases on the SAME bundled Natural Earth feature.
// Never substitute a parent or sovereign country for an observation's territory.
const aliases=Object.freeze({SDS:'SSD',PSX:'PSE',SAH:'ESH',ALD:'ALA'});
export const countrySourceId=id=>aliases[id]||id;

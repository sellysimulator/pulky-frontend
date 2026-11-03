/**
 * Copy for the hidden defaults (spec §9.3): the four risk odds whose defaults no
 * host sees before the game ends. Which fields they are comes from the server
 * (`fields[path].hidden_default`, `GET /config/defaults`); a null value in the
 * host's config stands for the default.
 */
export const HIDDEN_PLACEHOLDER = 'Default (hidden)'
export const HIDDEN_HELPER = 'Blank keeps the default, revealed when the game ends.'
export const HIDDEN_FIGURE = 'Hidden until the game ends'
export const HIDDEN_EXAMPLE = 'Hidden until the game ends. Type a value to see this example.'
export const CALCULATOR_HIDDEN_NOTE = 'Type the failure chance and the loss share to use the calculator.'
export const PIPELINE_WITHOUT_LEAD_TIME = 'No effect with a lead time of 0: nothing is on its way at the start.'

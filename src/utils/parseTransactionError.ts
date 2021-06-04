const containsAny = (str: string, substrings: string[]): string | null => {
  // @ts-ignore
  for (let i = 0; i !== substrings.length; i++) {
    const substring = substrings[i];
    if (str.indexOf(substring) !== -1) {
      return substring;
    }
  }
  return null;
};

// a mapping of reasons why any transaction might fail and the human-readable version of that error
const commonErrors = {
  // user messed up manual gas values
  'transaction underpriced':
    'Transaction under-priced. Please check the supplied gas amount and try again.',
  'intrinsic gas too low':
    'Transaction under-priced. Please check the supplied gas amount and try again.',

  // user denied signature via metamask
  'User denied transaction signature': 'Denied transaction signature',
  'User denied message signature': 'Denied transaction signature',

  // transfer specific - recieving address may have been a crucible address
  'transfer to non ERC721Receiver implementer':
    'Invalid transfer recipient address',

  // balance errors
  'insufficient balance': 'Insufficient balance',

  // Flashbots errors
  'missing response':
    'Invalid network - Flashbots supported on Mainnet or Görli',
  'invalid chain id for signer':
    'Invalid network - Flashbots supported on Mainnet or Görli',
};

const parseTransactionError = (error: any) => {
  const errorMsg =
    error?.error?.message || error?.message || 'Transaction Failed';

  console.log('TRANSACTION ERROR', errorMsg);

  const commonError = containsAny(errorMsg, Object.keys(commonErrors));

  if (commonError) {
    // @ts-ignore
    return commonErrors[commonError];
  }
  return errorMsg;
};

export default parseTransactionError;

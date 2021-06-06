import { BigNumber } from '@ethersproject/bignumber';

interface TransactionData {
  status: string;
  message: string;
  result: Transaction[];
}

interface Transaction {
  blockHash: string;
  blockNumber: string;
  confirmations: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  from: string;
  gas: BigNumber;
  gasPrice: BigNumber;
  gasUsed: BigNumber;
  hash: string;
  input: string;
  nonce: string;
  timeStamp: string;
  to: string;
  tokenDecimal: string;
  tokenName: string;
  tokenSymbol: string;
  transactionIndex: string;
  value: BigNumber;
}

interface Asset {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  value: BigNumber;
}

export interface AssetWithBalance {
  [key: string]: Asset;
}

export const getContainedAssets = async (
  address: string,
  chainId: number,
  etherscanApiKey: string
) => {
  const endpoint =
    chainId === 1
      ? `/etherscan-api-mainnet/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=asc&apikey=${etherscanApiKey}`
      : `/etherscan-api-rinkeby/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=asc&apikey=${etherscanApiKey}`;

  try {
    const response = await fetch(endpoint);
    const data: TransactionData = await response.json();

    const assetsWithBalance: AssetWithBalance = {};

    if (data.message !== 'OK') {
      throw new Error((data.result as unknown) as string);
    }

    data.result.map((tx) => {
      if (tx.contractAddress in assetsWithBalance) {
        assetsWithBalance[tx.contractAddress] = {
          ...assetsWithBalance[tx.contractAddress],
          value:
            tx.from === address
              ? assetsWithBalance[tx.contractAddress].value.sub(
                  BigNumber.from(tx.value)
                )
              : assetsWithBalance[tx.contractAddress].value.add(
                  BigNumber.from(tx.value)
                ),
        };
      } else {
        assetsWithBalance[tx.contractAddress] = {
          contractAddress: tx.contractAddress,
          tokenName: tx.tokenName,
          tokenSymbol: tx.tokenSymbol,
          value:
            tx.from === address
              ? BigNumber.from(tx.value).mul(-1)
              : BigNumber.from(tx.value),
        };
      }
      return tx;
    });

    Object.keys(assetsWithBalance).map((key) => {
      if (assetsWithBalance[key].value.lte(0)) {
        delete assetsWithBalance[key];
      }
      return null;
    });

    const resultsArray = [];

    for (const o in assetsWithBalance) {
      resultsArray.push(assetsWithBalance[o]);
    }

    return resultsArray;
  } catch (err) {
    throw err;
  }
};

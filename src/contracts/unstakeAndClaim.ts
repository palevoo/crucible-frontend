import { BigNumber, ethers, Wallet, providers } from 'ethers';
import {
  FlashbotsBundleProvider,
  FlashbotsTransactionResponse,
} from '@flashbots/ethers-provider-bundle';
import { signPermission } from './utils';
import { aludelAbi } from '../abi/aludelAbi';
import { crucibleAbi } from '../abi/crucibleAbi';
import { CallbackArgs, EVENT } from '../hooks/useContract';
import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json';

//Required for local signing
import { keccak256 } from '@ethersproject/keccak256';
import { PopulatedTransaction } from '@ethersproject/contracts';
import { SignatureLike } from '@ethersproject/bytes';

async function unstakeAndClaim(
  aludelAddress: string,
  signer: any,
  crucibleAddress: string,
  amount: BigNumber,
  callback: (args: CallbackArgs) => void
) {
  //retrieve data from signer
  let chainID = (await signer.provider.getNetwork()).chainId;
  let chainName = (await signer.provider.getNetwork()).chainName;
  const walletAddress = await signer.getAddress();

  // fetch contracts
  const aludel = new ethers.Contract(aludelAddress, aludelAbi, signer);
  const stakingToken = new ethers.Contract(
    (await aludel.getAludelData()).stakingToken,
    IUniswapV2ERC20.abi,
    signer
  );
  const crucible = new ethers.Contract(crucibleAddress, crucibleAbi, signer);

  const nonce = await crucible.getNonce();
  const recipient = walletAddress;

  try {
    // validate balances
    if ((await stakingToken.balanceOf(crucible.address)).lt(amount)) {
      throw new Error('You do not have enough LP tokens');
    }

    callback({
      type: EVENT.PENDING_SIGNATURE,
      step: 1,
      totalSteps: 2,
    });

    // craft permission
    console.log('Sign Unlock permission');
    const permission = await signPermission(
      'Unlock',
      crucible,
      signer,
      aludel.address,
      stakingToken.address,
      amount,
      nonce
    );

    console.log('Unstake and Claim');

    const estimatedGas = await aludel.estimateGas.unstakeAndClaim(
      crucible.address,
      recipient,
      amount,
      permission
    );

    let estimateGasPrice;

    await fetch('https://www.gasnow.org/api/v3/gas/price?utm_source=:crucible')
      .then((response) => response.json())
      .then((result) => {
        if (result.code == 200) {
          if (result.data.fast > 0 && result.data.rapid > 0) {
            estimateGasPrice = ethers.BigNumber.from(result.data.rapid)
              .sub(ethers.BigNumber.from(result.data.fast))
              .div(2)
              .add(ethers.BigNumber.from(result.data.fast));
          } else {
            callback({
              type: EVENT.TX_ERROR,
              message: 'Gasprice returned by API is too low, please try again.',
              code: 0,
            });
            return;
          }
        } else {
          callback({
            type: EVENT.TX_ERROR,
            message: 'Unable to retrieve Gas price from API, please try again.',
            code: 0,
          });
          return;
        }
      })
      .catch((error) => {
        callback({
          type: EVENT.TX_ERROR,
          message: error.message,
          code: error.code,
        });
        return;
      });

    console.log('gasLimit Estimate unstakeAndClaim: ' + estimatedGas);
    console.log('Current gasPrice Estimate: ' + estimateGasPrice);

    callback({
      type: EVENT.PENDING_SIGNATURE,
      step: 2,
      totalSteps: 2,
    });
    console.log('Sign Populated TX');

    let populatedResponse = {};
    let hash: string = '';
    let serialized;

    let nonce_user = await aludel.signer.getTransactionCount();

    await aludel.populateTransaction
      .unstakeAndClaim(crucible.address, recipient, amount, permission, {
        nonce: nonce_user,
        gasLimit: estimatedGas,
        gasPrice: estimateGasPrice,
      })
      .then((response: PopulatedTransaction) => {
        delete response.from;
        response.chainId = chainID;
        serialized = ethers.utils.serializeTransaction(response);
        hash = keccak256(serialized);
        populatedResponse = response;
        return populatedResponse;
      });

    const addr = await signer.getAddress();

    // Get the MetaMask flag from and change it to false it in ethers
    // This prevents ethers from replacing eth_sign to personal_sign.
    let isMetaMask: boolean | undefined;

    if (signer.provider.provider.isMetaMask) {
      isMetaMask = signer.provider.provider.isMetaMask;
      signer.provider.provider.isMetaMask = false;
    }

    const getSignature_unstake = await signer.provider
      .send('eth_sign', [addr.toLowerCase(), ethers.utils.hexlify(hash)])
      .then((signature: SignatureLike) => {
        const txWithSig = ethers.utils.serializeTransaction(
          populatedResponse,
          signature
        );
        return txWithSig;
      })
      .finally(() => {
        if (signer.provider.provider.isMetaMask) {
          signer.provider.provider.isMetaMask = isMetaMask;
        }
      });

    console.log('Prepare Flashbots!');

    callback({
      type: EVENT.TX_PENDING_FLASHBOTS,
    });

    //flashbots API variables
    let flashbotsAPI;

    if (chainID == 1) {
      flashbotsAPI = '/flashbots-relay-mainnet/';
    } else if (chainID == 5) {
      flashbotsAPI = '/flashbots-relay-goerli/';
    }

    //Flashbots Initilize
    const provider = providers.getDefaultProvider();
    const authSigner = Wallet.createRandom();
    const wallet = Wallet.createRandom().connect(provider);
    // Flashbots provider requires passing in a standard provider
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
      authSigner, // ethers.js signer wallet, only for signing request payloads, not transactions
      flashbotsAPI,
      chainName
    );

    const flashbotsTransactionBundle = [
      {
        signer: wallet,
        transaction: {
          to: wallet.address,
          gasPrice: 0,
        },
      },
      {
        signedTransaction: getSignature_unstake,
      },
    ];

    const blockNumber = await provider.getBlockNumber();

    const minTimestamp = (await provider.getBlock(blockNumber)).timestamp;
    const maxTimestamp = minTimestamp + 240; // 60 * 4 min max timeout

    const signedTransactions = await flashbotsProvider.signBundle(
      flashbotsTransactionBundle
    );

    const simulation = await flashbotsProvider.simulate(
      signedTransactions,
      blockNumber + 1
    );

    if ('error' in simulation) {
      callback({
        type: EVENT.TX_ERROR,
        message: simulation.error.message,
        code: simulation.error.code,
      });
      return;
    }

    const data = await Promise.all(
      Array.from(Array(15).keys()).map(async (v) => {
        const response = (await flashbotsProvider.sendBundle(
          flashbotsTransactionBundle,
          blockNumber + 1 + v,
          {
            minTimestamp,
            maxTimestamp,
          }
        )) as FlashbotsTransactionResponse;
        console.log(
          'Submitting Bundle to Flashbots for inclusion attempt on Block ' +
            (blockNumber + 1 + v)
        );
        return response;
      })
    );

    let successFlag = 0;

    await Promise.all(
      data.map(async (v, i) => {
        const response = await v.wait();

        console.log('Bundle ' + (i + 1) + ': ' + JSON.stringify(response));

        if (response == 0) {
          successFlag = 1;

          callback({
            type: EVENT.TX_CONFIRMED_FLASHBOTS,
            message:
              'Your transaction was successfully completed via Flashbots!',
          });
          return;
        }
      })
    );

    if (successFlag == 0) {
      callback({
        type: EVENT.TX_ERROR,
        message:
          'Failed to get Bundle included via Flashbots, please try again.',
        code: 0,
      });
      return;
    }
  } catch (e) {
    // Hack to silence 'Internal JSON-RPC error'
    if (e.code === -32603) {
      return;
    }
    callback({
      type: EVENT.TX_ERROR,
      message: e.message,
      code: e.code,
    });
    console.log(e);
  }
}

export default unstakeAndClaim;

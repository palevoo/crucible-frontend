import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { BigNumber } from 'ethers';
import { Erc20DetailedFactory } from '../../interfaces/Erc20DetailedFactory';
import { Erc20Detailed } from '../../interfaces/Erc20Detailed';
import { TokenInfo, Tokens, tokensReducer } from './tokenReducer';
import { useWeb3React } from '@web3-react/core';
import useConfigVariables from '../../hooks/useConfigVariables';

type TokenConfig = {
  address: string;
  name?: string;
  symbol?: string;
  imageUri?: string;
};

type TokensToWatch = {
  [networkId: number]: TokenConfig[];
};

type TokenContextProps = {
  children: ReactNode;
  tokensToWatch?: TokensToWatch;
};

type TokenContextType = {
  ethBalance?: BigNumber;
  tokens: Tokens;
};

const TokenContext = createContext<TokenContextType | undefined>(undefined);

const TokenProvider = ({ children }: TokenContextProps) => {
  const { account, chainId, library, active } = useWeb3React();
  const [ethBalance, setEthBalance] = useState<BigNumber | undefined>(
    undefined
  );
  const [tokens, tokensDispatch] = useReducer(tokensReducer, {});
  const { mistTokenAddress, lpTokenAddress } = useConfigVariables();

  const tokensToWatch = useMemo(
    () => ({
      [chainId || 1]: [
        {
          address: mistTokenAddress,
          name: 'Mist',
          symbol: '⚗️',
        },
        {
          address: lpTokenAddress,
          name: 'LP',
          symbol: '🧙',
        },
      ],
    }),
    [chainId]
  );

  // get ETH balance
  useEffect(() => {
    const fetchEthBalance = async () => {
      if (library && account) {
        setEthBalance(await library.getBalance(account));
      } else {
        setEthBalance(BigNumber.from(0));
      }
    };
    fetchEthBalance();
  }, [library, account, active]);

  // get other token balances
  useEffect(() => {
    const checkBalanceAndAllowance = async (token: Erc20Detailed) => {
      if (account) {
        const balance = await token.balanceOf(account);
        tokensDispatch({
          type: 'updateTokenBalanceAllowance',
          payload: {
            id: token.address,
            spenderAllowance: balance,
            balance,
          },
        });
      }
    };

    const networkTokens =
      (tokensToWatch && chainId && tokensToWatch[chainId]) || [];

    let tokenContracts: Array<Erc20Detailed> = [];
    if (library && account && networkTokens.length > 0) {
      networkTokens.forEach(async (token) => {
        const signer = await library.getSigner();
        const tokenContract = Erc20DetailedFactory.connect(
          token.address,
          signer
        );

        const newTokenInfo: TokenInfo = {
          decimals: 0,
          name: token.name,
          symbol: token.symbol,
          spenderAllowance: BigNumber.from(0),
          allowance: tokenContract.allowance,
          approve: tokenContract.approve,
          transfer: tokenContract.transfer,
        };

        if (!token.name) {
          try {
            newTokenInfo.name = await tokenContract.name();
          } catch (error) {
            console.log(
              'There was an error getting the token name. Does this contract implement ERC20Detailed?'
            );
          }
        }
        if (!token.symbol) {
          try {
            newTokenInfo.symbol = await tokenContract.symbol();
          } catch (error) {
            console.error(
              'There was an error getting the token symbol. Does this contract implement ERC20Detailed?'
            );
          }
        }

        try {
          newTokenInfo.decimals = await tokenContract.decimals();
        } catch (error) {
          console.error(
            'There was an error getting the token decimals. Does this contract implement ERC20Detailed?'
          );
        }

        tokensDispatch({
          type: 'addToken',
          payload: { id: token.address, token: newTokenInfo },
        });

        // This filter is intentionally left quite loose.
        const filterTokenApproval = tokenContract.filters.Approval(
          account,
          null,
          null
        );
        const filterTokenTransferFrom = tokenContract.filters.Transfer(
          account,
          null,
          null
        );
        const filterTokenTransferTo = tokenContract.filters.Transfer(
          null,
          account,
          null
        );

        const handler = () => {
          checkBalanceAndAllowance(tokenContract).catch(console.error);
        };
        tokenContract.on(filterTokenApproval, handler);
        tokenContract.on(filterTokenTransferFrom, handler);
        tokenContract.on(filterTokenTransferTo, handler);
        tokenContracts.push(tokenContract);
        handler();
      });
    }
    return () => {
      if (tokenContracts.length > 0) {
        tokenContracts.forEach((tc) => {
          tc.removeAllListeners();
        });
        tokenContracts = [];
        tokensDispatch({ type: 'resetTokens' });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, library, account]);

  return (
    <TokenContext.Provider
      value={{
        ethBalance,
        tokens,
      }}
    >
      {children}
    </TokenContext.Provider>
  );
};

const useTokens = () => {
  const context = useContext(TokenContext);
  if (context === undefined) {
    throw new Error('useTokens must be used within the TokenProvider');
  }
  return context;
};

export { TokenProvider, useTokens };

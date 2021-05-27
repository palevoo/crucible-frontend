import { Button } from '@chakra-ui/button';
import { InputRightElement } from '@chakra-ui/input';
import { Box, Flex, Text } from '@chakra-ui/layout';
import { NumberInput, NumberInputField } from '@chakra-ui/number-input';
import { Select } from '@chakra-ui/react';
import { useState } from 'react';
import { Crucible } from '../../../../store/crucibles';
import { useContract } from '../../../../hooks/useContract';
import useContracts from '../../../../contracts/useContracts';
import bigNumberishToNumber from '../../../../utils/bigNumberishToNumber';
import getStep from '../../../../utils/getStep';
import onNumberInputChange from '../../../../utils/onNumberInputChange';
import formatNumber from '../../../../utils/formatNumber';
import { useWeb3React } from '@web3-react/core';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import numberishToBigNumber from '../../../../utils/numberishToBigNumber';

type Props = {
  crucible: Crucible;
};

type withdrawFromCrucibleParams = Parameters<
  (
    crucibleAddress: string,
    tokenAddress: string,
    signer: Signer,
    amount: BigNumber
  ) => void
>;

const WithdrawCrucibleAssets: React.FC<Props> = ({ crucible }) => {
  const { withdrawFromCrucible } = useContracts();
  const { library } = useWeb3React();
  const { invokeContract, ui } = useContract(withdrawFromCrucible);
  const [isMax, setIsMax] = useState(false);
  const [amount, setAmount] = useState('0');
  const [selectedAsset, setSelectedAsset] = useState(
    crucible.containedAssets[0]
  );

  if (crucible.containedAssets.length === 0) {
    return (
      <Box>
        <Text>This crucible has no assets that can be withdrawn</Text>
      </Box>
    );
  }

  const tokenBalance = selectedAsset.value;
  const tokenBalanceNumber = bigNumberishToNumber(tokenBalance);
  const amountBigNumber = numberishToBigNumber(amount || 0);
  const step = getStep(tokenBalanceNumber);

  const handleSetSelectedAsset = (e: any) => {
    const selected =
      crucible.containedAssets.find(
        (asset) => asset.contractAddress === e.target.value
      ) || crucible.containedAssets[0];
    setSelectedAsset(selected);
  };

  const onChange = (amountNew: number | string) => {
    onNumberInputChange(
      amountNew,
      amount,
      tokenBalance,
      isMax,
      setAmount,
      setIsMax
    );
  };

  const handleWithdrawFromCrucible = () => {
    const signer = library?.getSigner() as Signer;

    // BUG: Amount big number is always 0
    console.log(crucible.id);
    console.log(selectedAsset.contractAddress);
    console.log(tokenBalance);
    console.log(amountBigNumber);

    invokeContract<withdrawFromCrucibleParams>(
      crucible.id,
      selectedAsset.contractAddress,
      signer,
      isMax && tokenBalance ? tokenBalance : amountBigNumber
    );
  };

  return (
    <Box p={[6]} bg='white' color='gray.800' borderRadius='xl'>
      <Flex alignItems='center' justifyContent='space-between' mb={2}>
        <Text>Select amount to withdraw</Text>
        <Text>
          Balance: {tokenBalance ? formatNumber.token(tokenBalanceNumber) : '-'}{' '}
          {selectedAsset.tokenSymbol}
        </Text>
      </Flex>

      <NumberInput
        mb={4}
        size='lg'
        bg='gray.50'
        step={step}
        min={0}
        max={tokenBalanceNumber}
        value={isMax ? tokenBalanceNumber.toString() : amount}
        onChange={onChange}
        borderRadius='xl'
      >
        <NumberInputField
          pr='14rem'
          fontSize='xl'
          fontWeight='bold'
          borderRadius='xl'
          _hover={{
            borderColor: 'gray.600',
          }}
          _focus={{
            borderColor: 'gray.600',
            borderWidth: '2px',
          }}
        />
        <InputRightElement width='fit-content'>
          <Flex>
            <Button
              variant='ghost'
              onClick={() => setIsMax(true)}
              color='gray.600'
            >
              Max
            </Button>
            <Select onChange={handleSetSelectedAsset}>
              {crucible.containedAssets.map((asset) => (
                <option
                  key={asset.contractAddress}
                  value={asset.contractAddress}
                >
                  {asset.tokenSymbol}
                </option>
              ))}
            </Select>
          </Flex>
        </InputRightElement>
      </NumberInput>
      <Button isFullWidth onClick={handleWithdrawFromCrucible}>
        Withdraw from Crucible
      </Button>
      {ui}
    </Box>
  );
};

export default WithdrawCrucibleAssets;

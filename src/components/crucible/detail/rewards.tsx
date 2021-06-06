import React, { FC, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  GridItem,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/layout';
import { Progress } from '@chakra-ui/react';
import { Crucible } from '../../../context/crucibles';
import { BigNumber } from '@ethersproject/bignumber';
import { Button } from '@chakra-ui/button';
import dayjs from 'dayjs';
import IncreaseStakeModal from '../../modals/increaseStakeModal';
import WithdrawModal from '../../modals/withdrawModal';
import StatCard from '../../shared/StatCard';
import formatNumber from '../../../utils/formatNumber';
import getMultiplier from '../../../utils/getMultiplier';
import { useModal } from '../../../store/modals';
import { ModalType } from '../../modals/types';

type Props = {
  crucible: Crucible;
};
const Rewards: FC<Props> = ({ crucible }) => {
  const { openModal } = useModal();
  const [increaseStakeModalOpen, setIncreaseStakeModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [hasIncreasedStakeThisPageLoad, setHasIncreasedStakeThisPageLoad] =
    useState(false);

  let mistRewardsUsd;
  let wethRewardsUsd;
  let aggregateRewardsUsd;
  let lpUsd;
  let totalUsd;

  const {
    mistRewards,
    wethRewards,
    mistPrice,
    wethPrice,
    currentWethInLp,
    currentMistInLp,
  } = crucible;

  if (
    mistRewards &&
    wethRewards &&
    mistPrice &&
    wethPrice &&
    currentWethInLp &&
    currentMistInLp
  ) {
    mistRewardsUsd = mistRewards.mul(mistPrice).div(getMultiplier());
    wethRewardsUsd = wethRewards.mul(wethPrice).div(getMultiplier());
    aggregateRewardsUsd = mistRewardsUsd.add(wethRewardsUsd);

    const currentMistInLpUsd = currentMistInLp
      .mul(mistPrice)
      .div(getMultiplier());
    const currentWethInLpUsd = currentWethInLp
      .mul(wethPrice)
      .div(getMultiplier());
    lpUsd = currentMistInLpUsd.add(currentWethInLpUsd);
    totalUsd = lpUsd.add(aggregateRewardsUsd);
  }

  const isInFlight = () => {
    return !!localStorage.getItem('inFlightSubscriptionHash');
  };

  const subscriptionBoundaries = useMemo(() => {
    if (crucible.stakes.length >= 1) {
      const flattened = crucible.stakes
        .map((stake) => ({
          timestamp: Number(stake.timestamp),
          amount: stake.amount,
        }))
        .reverse();

      let sum = BigNumber.from(0);
      return flattened.map((v) => (sum = sum.add(v.amount)));
    }
    return [];
  }, [crucible]);

  return (
    <Box p={[4, 8]} bg='white' color='gray.800' borderRadius='xl'>
      <Stack direction={['column', 'row']} mb={4} justify='space-around'>
        <VStack fontSize={['sm', 'md']} align='center'>
          <Text>Total Value</Text>
          <Text fontWeight='bold' fontSize='lg'>
            {totalUsd ? formatNumber.currency(totalUsd) : '-'}
          </Text>
        </VStack>
        <VStack fontSize={['sm', 'md']} align='center'>
          <Text>LP Value</Text>
          <Text fontWeight='bold' fontSize='lg'>
            {lpUsd ? formatNumber.currency(lpUsd) : '-'}
          </Text>
        </VStack>
        <VStack fontSize={['sm', 'md']} align='center'>
          <Text>Rewards</Text>
          <Text fontWeight='bold' fontSize='lg'>
            {aggregateRewardsUsd
              ? formatNumber.currency(aggregateRewardsUsd)
              : '-'}
          </Text>
        </VStack>
      </Stack>

      <SimpleGrid columns={[1, 2]} gap={[2, 4]}>
        <StatCard
          title='MIST Rewards'
          label={mistRewards ? formatNumber.token(mistRewards) : '-'}
          subLabel={
            mistRewardsUsd ? formatNumber.currency(mistRewardsUsd) : '-'
          }
          arrowOnSubLabel
        />
        <StatCard
          title='ETH Rewards'
          label={wethRewards ? formatNumber.token(wethRewards) : '-'}
          subLabel={
            wethRewardsUsd ? formatNumber.currency(wethRewardsUsd) : '-'
          }
          arrowOnSubLabel
        />
      </SimpleGrid>

      <VStack width='100%' align='stretch' my={6} textAlign='left'>
        <Box>
          {crucible!.stakes.length > 0 && (
            <Text fontSize='sm' pb={1}>
              Reward Scaling Period
            </Text>
          )}
          <VStack>
            {crucible!.stakes.map((stake, i) => {
              const daysAgo: number = Math.min(
                dayjs().diff(stake.timestamp * 1000, 'day'),
                60
              );
              const secondsAgo: number = dayjs().diff(
                stake.timestamp * 1000,
                'second'
              );
              const secondsMax = 60 * 24 * 60 * 60;
              const progress = Math.min(secondsAgo / secondsMax, 1);

              const subscribedAt: string = formatNumber.date(
                stake.timestamp * 1000
              ); // dayjs(stake.timestamp).format('DD-MMM-YY');

              return (
                <Box key={i} width='100%'>
                  <Text fontSize='xs' pt={1} pb={2}>
                    Subscription {i + 1}: {formatNumber.token(stake.amount)} LP
                    ({subscribedAt})
                  </Text>
                  <Progress
                    value={progress * 100}
                    size='xs'
                    colorScheme='purple'
                    backgroundColor='lightgray'
                  />
                  <Text fontSize='xs' pt={1} pb={4}>
                    {progress === 1
                      ? formatNumber.percentShort(progress)
                      : formatNumber.percent(progress)}{' '}
                    Complete ({daysAgo} of 60 Days to max reward multiplier)
                  </Text>
                </Box>
              );
            })}
          </VStack>
          <HStack>
            <Text fontSize='sm'>
              Subscribed Crucible LP:{' '}
              <strong>{formatNumber.token(crucible.lockedBalance)}</strong>
            </Text>
            <Text fontSize='sm'>
              Unsubscribed Crucible LP:{' '}
              <strong>{formatNumber.token(crucible.unlockedBalance)}</strong>
            </Text>
          </HStack>
        </Box>
      </VStack>

      <Grid
        templateRows='repeat(2, 1fr)'
        templateColumns='repeat(2, 1fr)'
        gap={4}
      >
        <GridItem colSpan={[2, 2, 1]}>
          <Button
            isFullWidth
            disabled={hasIncreasedStakeThisPageLoad && isInFlight()}
            onClick={() => {
              setHasIncreasedStakeThisPageLoad(true);
              setIncreaseStakeModalOpen(true);
            }}
          >
            <Text fontSize='sm'>Increase LP subscription</Text>
          </Button>
        </GridItem>
        <GridItem colSpan={[2, 2, 1]}>
          <Button
            isFullWidth
            disabled={crucible.lockedBalance.isZero()}
            onClick={() =>
              openModal(ModalType.claimRewards, {
                crucible,
                subscriptionBoundaries,
              })
            }
          >
            <Text fontSize='sm'>Claim rewards and unsubscribe</Text>
          </Button>
        </GridItem>
        <GridItem colSpan={[2]}>
          <Button
            isFullWidth
            disabled={crucible.unlockedBalance.lte(0)}
            onClick={() => setWithdrawModalOpen(true)}
          >
            <Text fontSize='sm'>Withdraw unsubscribed LP</Text>
          </Button>
        </GridItem>
      </Grid>

      {crucible.unlockedBalance.lte(0) && (
        <Text fontSize='sm' color='gray.400'>
          To withdraw, first unsubscribe your LP
        </Text>
      )}
      {increaseStakeModalOpen && (
        <IncreaseStakeModal
          crucible={crucible}
          onClose={() => setIncreaseStakeModalOpen(false)}
        />
      )}
      {withdrawModalOpen && (
        <WithdrawModal
          crucible={crucible}
          onClose={() => setWithdrawModalOpen(false)}
        />
      )}
    </Box>
  );
};

export default Rewards;

import React, { FC } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/tabs';
import { Box, Flex, Heading } from '@chakra-ui/layout';
import { useCrucibles } from '../../context/crucibles';
import { Spinner } from '@chakra-ui/spinner';
import CruciblesListView from '../crucible/cruciblesListView';
import MintingForm from './mintingForm';

const MintingTabs: FC = () => {
  const { crucibles, isLoading } = useCrucibles();

  const tabProps = {
    borderRadius: 'lg',
    fontWeight: 'bold',
    _selected: { color: 'purple.800', bg: 'cyan.400' },
  };

  if (isLoading) {
    return (
      <Flex justifyContent='center' alignItems='center' flexGrow={1}>
        <Spinner />
      </Flex>
    );
  }

  return (
    <Box position='relative'>
      <Heading top='-120px' position='absolute' width='100%'>
        Minting Crucibles
      </Heading>
      <Tabs isFitted defaultIndex={crucibles && crucibles.length > 0 ? 1 : 0}>
        <TabList bg='gray.700' borderRadius='xl' border='none' p={2}>
          <Tab {...tabProps}>Mint</Tab>
          <Tab {...tabProps}>Your Crucibles</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0} pb={0}>
            <MintingForm />
          </TabPanel>
          <TabPanel px={0} pb={0}>
            <CruciblesListView />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default MintingTabs;

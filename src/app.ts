import Axios from "axios";

const GENESIS_BLOCK_TS = 1231006505;
const ESTIMATED_BITCOIN_BLOCKS_IN_1_DAY = 6 * 24; // 10 mins approx. btc block time

type Timestamp = number;
type BlockHeight = number;

// Count API calls
var countChecksTs = 0;

const getLatestBlockHeight = async (): Promise<BlockHeight> => {
  return await Axios.get(`https://blockchain.info/latestblock`)
    .then((response) => {
      return response.data.height;
    })
    .catch((err) => console.log(err));
};

const getISOStringForTimestamp = (ts: Timestamp): string => {
  return new Date(ts * 1000).toISOString();
};

const getBlockTimestamp = async (
  blockHeight: BlockHeight
): Promise<Timestamp> => {
  countChecksTs++;
  return await Axios.get(
    `https://blockchain.info/block-height/${blockHeight}?format=json`
  )
    .then((response) => {
      const foundTSinBlock = response.data.blocks[0].time;
      console.log(
        `(${countChecksTs}) getBlockTimestamp is ${foundTSinBlock} for block #${blockHeight} - aka: ${getISOStringForTimestamp(
          foundTSinBlock
        )}`
      );
      return response.data.blocks[0].time;
    })
    .catch((err) => console.log(err));
};

const daysDifference = (
  timestamp1: Timestamp,
  timestamp2: Timestamp
): number => {
  const diffDays = Math.floor(
    (timestamp1 * 1000 - timestamp2 * 1000) / (1000 * 60 * 60 * 24)
  );
  return diffDays;
};

const estimateBlockHeight = (
  timestampToFind: Timestamp,
  latestBlockTs: Timestamp,
  latestBlockHeight: BlockHeight
): BlockHeight => {
  let estimatedBlockHeight: BlockHeight | undefined = undefined;
  const diffDaysFromStart = daysDifference(timestampToFind, GENESIS_BLOCK_TS);
  const diffDaysFromEnd = daysDifference(latestBlockTs, timestampToFind); //
  // estimate from start (genesis) or latest block ? which is closer ?
  if (diffDaysFromStart < diffDaysFromEnd) {
    estimatedBlockHeight =
      diffDaysFromStart * ESTIMATED_BITCOIN_BLOCKS_IN_1_DAY;
  } else {
    estimatedBlockHeight =
      latestBlockHeight - diffDaysFromEnd * ESTIMATED_BITCOIN_BLOCKS_IN_1_DAY;
  }
  return estimatedBlockHeight;
};

const findBlockHeight = async (timestampToFind: Timestamp) => {
  console.log(
    `
    
    findBlockHeight(timestampToFind = ${timestampToFind}) - aka: ${getISOStringForTimestamp(
      timestampToFind
    )}`
  );
  if (timestampToFind <= GENESIS_BLOCK_TS) {
    throw new Error(`timestampToFind is prior/equal to genesis block`);
  }

  const latestBlockHeight: BlockHeight = await getLatestBlockHeight();
  const timestampLatestBlock: Timestamp = await getBlockTimestamp(
    latestBlockHeight
  );

  if (timestampToFind >= timestampLatestBlock) {
    throw new Error(`timestampToFind is later than latest block's ts`);
  }

  const estimatedHeight = estimateBlockHeight(
    timestampToFind,
    timestampLatestBlock,
    latestBlockHeight
  );

  console.log(
    `${await findBlockMatchingTimestamp(timestampToFind, estimatedHeight)}`
  );
};

const findBlockMatchingTimestamp = async (
  timestampToFind: Timestamp,
  maxBlockHeight: BlockHeight
): Promise<BlockHeight> => {
  const needleBlockTimestamp: Timestamp = await getBlockTimestamp(
    maxBlockHeight
  );
  const daysDiffEstimateVsDestination = daysDifference(
    needleBlockTimestamp,
    timestampToFind
  );
  let minBlockHeight;
  if (timestampToFind > needleBlockTimestamp) {
    // go ahead
    minBlockHeight =
      maxBlockHeight +
      (-daysDiffEstimateVsDestination + 1) * ESTIMATED_BITCOIN_BLOCKS_IN_1_DAY;
  } else {
    // go back
    minBlockHeight =
      maxBlockHeight -
      (daysDiffEstimateVsDestination + 1) * ESTIMATED_BITCOIN_BLOCKS_IN_1_DAY;
  }
  //
  // e.g:
  //
  // findBlockHeight(timestampToFind = 1637430034) - aka: 2021-11-20T17:40:34.000Z
  // maxBlockHeight: 710678 = 2021-11-21T09:27:50.000Z
  // minBlockHeight: 710534 = 2021-11-20T08:39:58.000Z
  //
  let pivotMiddleHeight: BlockHeight | undefined;
  let pivotTs: Timestamp | undefined;
  while (maxBlockHeight - minBlockHeight > 1) {
    pivotMiddleHeight = Math.floor((minBlockHeight + maxBlockHeight) / 2);
    pivotTs = await getBlockTimestamp(pivotMiddleHeight);
    if (pivotTs > timestampToFind) {
      maxBlockHeight = pivotMiddleHeight;
    } else {
      minBlockHeight = pivotMiddleHeight;
    }
  }
  console.log(`Out`);
  if (pivotTs > timestampToFind) {
    return pivotMiddleHeight - 1;
  } else {
    return pivotMiddleHeight;
  }
};

(async function () {
  // First Example:
  await findBlockHeight(1232103989);

  // Reset API count + run Second Example:
  countChecksTs = 0;
  await findBlockHeight(1637430034);
})();

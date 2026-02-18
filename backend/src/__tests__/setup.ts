import { stopDlqReplayWorker } from '../reliability/dlq-replay-worker';
import { resetReliabilityConfigForTest } from '../reliability/config';

afterEach(() => {
  stopDlqReplayWorker();
  resetReliabilityConfigForTest();
  jest.clearAllMocks();
});

afterAll(() => {
  stopDlqReplayWorker();
  resetReliabilityConfigForTest();
  jest.useRealTimers();
});

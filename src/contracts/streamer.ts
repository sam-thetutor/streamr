import * as Client from 'streamer';
import { rpcUrl } from './util';

export default new Client.Client({
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractId: 'CDGAKUYVMN3G4R5YQ2QEUPXVODZYQHYBSD4X6VQB2OEL7LG2DFZ2PYML',
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});

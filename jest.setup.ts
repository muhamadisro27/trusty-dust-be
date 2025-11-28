jest.mock('@noir-lang/noir_js', () => {
  class MockNoir {
    constructor() {}
    async execute() {
      return { witness: new Uint8Array(), returnValue: ['1'] };
    }
  }

  return {
    __esModule: true,
    Noir: MockNoir,
  };
}, { virtual: true });

jest.mock('@noir-lang/backend_barretenberg', () => {
  return {
    BarretenbergBackend: jest.fn().mockImplementation(() => ({
      generateProof: jest.fn().mockResolvedValue({ proof: new Uint8Array(), publicInputs: ['1'] }),
    })),
  };
}, { virtual: true });

jest.mock('@supabase/supabase-js', () => {
  const channelMock = {
    subscribe: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue('ok'),
    unsubscribe: jest.fn().mockResolvedValue('ok'),
  };

  const defaultQueryResponse = { data: [], error: null };

  const buildQuery = () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(defaultQueryResponse),
    };
    return query;
  };

  return {
    createClient: jest.fn(() => ({
      channel: jest.fn(() => ({
        ...channelMock,
      })),
      from: jest.fn(() => buildQuery()),
    })),
  };
});

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () =>
              JSON.stringify({
                txnScore: 50,
                tokenScore: 50,
                nftScore: 50,
                defiScore: 50,
                contractScore: 50,
                riskScore: 10,
                finalScore: 500,
                reasoning: 'mock',
              }),
          },
        }),
      }),
    })),
  };
}, { virtual: true });

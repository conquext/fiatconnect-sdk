import {
  createSiweConfig,
  FiatConnectClientImpl,
} from '../src/fiat-connect-client'
import {
  mockAddFiatAccountResponse,
  mockDeleteFiatAccountParams,
  mockFiatAccountSchemaData,
  mockGetFiatAccountsResponse,
  mockKycSchemaData,
  mockKycStatusResponse,
  mockQuoteErrorResponse,
  mockQuoteRequestQuery,
  mockQuoteInResponse,
  mockQuoteOutResponse,
  mockTransferRequestParams,
  mockTransferResponse,
  mockTransferStatusRequestParams,
  mockTransferStatusResponse,
  mockClockResponse,
  mockCreateQuoteParams,
} from './mocks'
import 'jest-fetch-mock'
import {
  FiatAccountSchema,
  FiatConnectError,
  KycSchema,
  Network,
  quotePreviewResponseSchema,
  quoteResponseSchema,
} from '@fiatconnect/fiatconnect-types'
import { ResponseError } from '../src/types'
import { Result } from '@badrap/result'

jest.mock('../src/siwe-client')

describe('FiatConnectClientImpl', () => {
  const accountAddress = '0x0d8e461687b7d06f86ec348e0c270b0f279855f0'
  const siweLoginMock = jest.fn()
  const siweIsLoggedInMock = jest.fn()
  const siweGetServerTimeApprox = jest.fn()
  const siweGetClockDiffApprox = jest.fn()
  const siweGetClock = jest.fn()
  const siweGetCookiesMock = jest.fn()

  const siweClientMock = {
    login: siweLoginMock,
    getCookies: siweGetCookiesMock,
    getServerTimeApprox: siweGetServerTimeApprox,
    getClockDiffApprox: siweGetClockDiffApprox,
    getClock: siweGetClock,
    isLoggedIn: siweIsLoggedInMock,
    fetch: fetch, // use the real fetch here as it makes mocking easy with fetch mock
  }

  const client = new FiatConnectClientImpl(
    {
      baseUrl: 'https://fiat-connect-api.com',
      network: Network.Alfajores,
      accountAddress,
      timeout: 1000,
    },
    siweClientMock,
    fetch,
  )

  const clientWithApiKey = new FiatConnectClientImpl(
    {
      baseUrl: 'https://fiat-connect-api.com',
      network: Network.Alfajores,
      accountAddress,
      apiKey: 'api-key',
    },
    siweClientMock,
    fetch,
  )

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    siweLoginMock.mockReset()
    siweIsLoggedInMock.mockReset()
    siweGetServerTimeApprox.mockReset()
    siweGetClockDiffApprox.mockReset()
    siweGetClock.mockReset()
    jest.clearAllMocks()
  })
  describe('getClock', () => {
    it('gets the server clock using siwe client', async () => {
      siweGetClock.mockResolvedValueOnce(mockClockResponse)
      const response = await client.getClock()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockClockResponse)
    })
    it('handles errors', async () => {
      siweGetClock.mockRejectedValueOnce(new Error('fake error message'))
      const response = await client.getClock()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message', undefined),
      )
    })
    it('handles schema validation errors', async () => {
      siweGetClock.mockResolvedValueOnce('wrong-schema')
      const response = await client.getClock()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema clockResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
  })
  describe('getServerTimeApprox', () => {
    it('gets using siwe client', async () => {
      siweGetServerTimeApprox.mockResolvedValueOnce(
        new Date('2022-05-01T00:00:00.500Z'),
      )
      const response = await client.getServerTimeApprox()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap().toISOString()).toEqual(
        '2022-05-01T00:00:00.500Z',
      )
    })
    it('returns an error if siwe client throws', async () => {
      siweGetServerTimeApprox.mockRejectedValueOnce(
        new Error('fake error message'),
      )
      const response = await client.getServerTimeApprox()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getClockDiffApprox', () => {
    it('gets using siwe client', async () => {
      siweGetClockDiffApprox.mockResolvedValueOnce({
        diff: 1000,
        maxError: 500,
      })

      const actualClockDiffResult = await client.getClockDiffApprox()
      expect(actualClockDiffResult.isOk).toBeTruthy()
      expect(actualClockDiffResult.unwrap()).toEqual({
        diff: 1000,
        maxError: 500,
      })
    })
    it('handles errors from siwe client', async () => {
      siweGetClockDiffApprox.mockRejectedValueOnce(
        new Error('fake error message'),
      )
      const response = await client.getClockDiffApprox()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('login', () => {
    it('calls siwe client login', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.resolve())
      const response = await client.login({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
      })

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toEqual('success')
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
      })
    })
    it('returns error if siwe login throws', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.reject('error'))
      const response = await client.login({
        issuedAt: new Date('2022-10-02T22:01:56+0000'),
      })

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(new ResponseError('error'))
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: new Date('2022-10-02T22:01:56+0000'),
      })
    })
    it('calls siwe client login with empty params', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.resolve())

      const response = await client.login()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toEqual('success')
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: undefined,
      })
    })
  })
  describe('isLoggedIn', () => {
    it('pipes siwe isLoggedIn', () => {
      siweIsLoggedInMock.mockReturnValueOnce(false)
      expect(client.isLoggedIn()).toBeFalsy()
      expect(siweIsLoggedInMock).toHaveBeenCalledWith()
    })
  })
  describe('_createQuote', () => {
    it('calls /quote/in and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteInResponse))
      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'in',
        quoteResponseSchema,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/in',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockQuoteRequestQuery),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockQuoteInResponse)
    })
    it('calls /quote/out and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteOutResponse))
      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'out',
        quoteResponseSchema,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/out',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockQuoteRequestQuery),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockQuoteOutResponse)
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify('wrong-schema'))
      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'in',
        quoteResponseSchema,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema quoteResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('validates using quotePreviewResponseSchema when it is passed', async () => {
      fetchMock.mockResponseOnce(JSON.stringify('wrong-schema'))

      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'in',
        quotePreviewResponseSchema,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema quotePreviewResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'in',
        quoteResponseSchema,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', mockQuoteErrorResponse),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'in',
        quoteResponseSchema,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
    it('aborts if request takes longer than the specified timeout', async () => {
      fetchMock.mockResponseOnce(async () => {
        jest.advanceTimersByTime(2000) // timeout is 1000
        return JSON.stringify(mockQuoteInResponse)
      })
      const response = await client._createQuote(
        mockQuoteRequestQuery,
        'in',
        quoteResponseSchema,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('AbortError'),
      )
    })
  })
  describe('createQuoteIn', () => {
    it('calls _createQuote with the expected parameters', async () => {
      const _createQuote = jest
        .spyOn(client, '_createQuote')
        .mockResolvedValueOnce(Result.ok(mockQuoteInResponse))
      const response = await client.createQuoteIn(mockCreateQuoteParams)
      expect(_createQuote).toHaveBeenCalledWith(
        {
          ...mockCreateQuoteParams,
          preview: false,
        },
        'in',
        quoteResponseSchema,
      )
      expect(response).toEqual(Result.ok(mockQuoteInResponse))
    })
  })
  describe('createQuoteOut', () => {
    it('calls _createQuote with the expected parameters', async () => {
      const _createQuote = jest
        .spyOn(client, '_createQuote')
        .mockResolvedValueOnce(Result.ok(mockQuoteOutResponse))
      const response = await client.createQuoteOut(mockCreateQuoteParams)
      expect(_createQuote).toHaveBeenCalledWith(
        {
          ...mockCreateQuoteParams,
          preview: false,
        },
        'out',
        quoteResponseSchema,
      )
      expect(response).toEqual(Result.ok(mockQuoteOutResponse))
    })
  })
  describe('getQuoteInPreview', () => {
    it('calls _createQuote with the expected parameters', async () => {
      const _createQuote = jest
        .spyOn(client, '_createQuote')
        .mockResolvedValueOnce(Result.ok(mockQuoteInResponse))
      const response = await client.getQuoteInPreview(mockCreateQuoteParams)
      expect(_createQuote).toHaveBeenCalledWith(
        {
          ...mockCreateQuoteParams,
          preview: true,
        },
        'in',
        quotePreviewResponseSchema,
      )
      expect(response).toEqual(Result.ok(mockQuoteInResponse))
    })
  })
  describe('getQuoteOutPreview', () => {
    it('calls _createQuote with the expected parameters', async () => {
      const _createQuote = jest
        .spyOn(client, '_createQuote')
        .mockResolvedValueOnce(Result.ok(mockQuoteOutResponse))
      const response = await client.getQuoteOutPreview(mockCreateQuoteParams)
      expect(_createQuote).toHaveBeenCalledWith(
        {
          ...mockCreateQuoteParams,
          preview: true,
        },
        'out',
        quotePreviewResponseSchema,
      )
      expect(response).toEqual(Result.ok(mockQuoteOutResponse))
    })
  })
  describe('addKyc', () => {
    it('calls POST /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
    })
    it('calls POST /kyc/${params.kycSchemaName} with auth header and returns KycStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
      const response = await clientWithApiKey.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 409,
      })
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await clientWithApiKey.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema kycStatusResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('deleteKyc', () => {
    it('calls DELETE /kyc/${params.kycSchemaName} and returns undefined', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}))
      const response = await client.deleteKyc({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toBeUndefined()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.deleteKyc({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.deleteKyc({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getKycStatus', () => {
    it('calls GET /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments/status',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema kycStatusResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('addFiatAccount', () => {
    it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fiatAccountSchema: FiatAccountSchema.AccountNumber,
            data: mockFiatAccountSchemaData,
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockAddFiatAccountResponse)
    })
    it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
      const response = await clientWithApiKey.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
          body: JSON.stringify({
            fiatAccountSchema: FiatAccountSchema.AccountNumber,
            data: mockFiatAccountSchemaData,
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockAddFiatAccountResponse)
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 409,
      })
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await clientWithApiKey.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema obfuscatedFiatAccountDataSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getFiatAccounts', () => {
    it('calls GET /accounts and returns GetFiatAccountsResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockGetFiatAccountsResponse))
      const response = await client.getFiatAccounts()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockGetFiatAccountsResponse)
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.getFiatAccounts()
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await client.getFiatAccounts()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema getFiatAccountsResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getFiatAccounts()
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('deleteFiatAccount', () => {
    it('calls DELETE /accounts/${params.fiatAccountId} and returns undefined', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}))
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts/12358',
        expect.objectContaining({ method: 'DELETE', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toBeUndefined()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('transferIn', () => {
    it('calls POST /transfer/in and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      const response = await client.transferIn(mockTransferRequestParams)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/in',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
    })
    it('calls POST /transfer/in with auth header and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      const response = await clientWithApiKey.transferIn(
        mockTransferRequestParams,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/in',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
            Authorization: 'Bearer api-key',
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await client.transferIn(mockTransferRequestParams)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema transferResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.transferIn(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.transferIn(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })

  describe('transferOut', () => {
    it('calls POST /transfer/out and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      const response = await client.transferOut(mockTransferRequestParams)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/out',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
    })
    it('calls POST /transfer/out with auth header and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      const response = await clientWithApiKey.transferOut(
        mockTransferRequestParams,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/out',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
            Authorization: 'Bearer api-key',
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await clientWithApiKey.transferOut(
        mockTransferRequestParams,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError(
          `Error validating object with schema transferResponseSchema. {"_errors":["Expected object, received string"]}`,
        ),
      )
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.transferOut(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.transferOut(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })

  describe('getTransferStatus', () => {
    it('calls GET /transfer/${params.transferId}/status and returns TransferStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferStatusResponse))
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/82938/status',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferStatusResponse)
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles schema validation errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(''))
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        /Error validating object with schema transferInStatusPreTxResponseSchema/,
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })

  describe('getCookies', () => {
    it('returns cookies using siwe client', async () => {
      siweGetCookiesMock.mockResolvedValueOnce('fake cookies')

      const response = await client.getCookies()

      expect(response).toEqual('fake cookies')
    })
  })
})

describe('createSiweConfig', () => {
  it('maps fiat connect client config to siwe client config', () => {
    expect(
      createSiweConfig({
        accountAddress: '0x123',
        network: Network.Alfajores,
        baseUrl: 'https://fiat-connect-api.com',
      }),
    ).toEqual({
      accountAddress: '0x123',
      statement: 'Sign in with Ethereum',
      version: '1',
      chainId: 44787,
      sessionDurationMs: 14400000,
      loginUrl: 'https://fiat-connect-api.com/auth/login',
      clockUrl: 'https://fiat-connect-api.com/clock',
      headers: undefined,
    })
  })

  it('maps fiat connect client config to siwe client config with optional params', () => {
    expect(
      createSiweConfig({
        accountAddress: '0x123',
        network: Network.Alfajores,
        baseUrl: 'https://fiat-connect-api.com',
        apiKey: 'token',
        timeout: 1000,
      }),
    ).toEqual({
      accountAddress: '0x123',
      statement: 'Sign in with Ethereum',
      version: '1',
      chainId: 44787,
      sessionDurationMs: 14400000,
      loginUrl: 'https://fiat-connect-api.com/auth/login',
      clockUrl: 'https://fiat-connect-api.com/clock',
      headers: { Authorization: 'Bearer token' },
      timeout: 1000,
    })
  })
})

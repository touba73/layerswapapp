import { createContext, useState, useContext, useEffect } from 'react'
import { SwapFormValues } from '../components/DTOs/SwapFormValues';
import LayerSwapApiClient from '../lib/layerSwapApiClient';
import useSWR from 'swr';
import { ApiResponse } from '../Models/ApiResponse';

const FeeStateContext = createContext<ContextType | null>(null);

type ContextType = {
    minAllowedAmount: number | undefined,
    maxAllowedAmount: number | undefined,
    fee: Fee,
    mutateFee: () => void,
    valuesChanger: (values: SwapFormValues) => void,
    isFeeLoading: boolean
}

export type Fee = {
    walletFee: number | undefined,
    manualFee: number | undefined,
    avgCompletionTime: string | undefined;
    walletReceiveAmount: number | undefined,
    manualReceiveAmount: number | undefined,
    refuelAmount: number | undefined
}

export function FeeProvider({ children }) {

    const [values, setValues] = useState<SwapFormValues>()
    const [cachedRateData, setCachedRateData] = useState<RateResponse>()

    const { fromCurrency, toCurrency, from, to, amount, refuel } = values || {}
    const [debouncedAmount, setDebouncedAmount] = useState(amount);

    const valuesChanger = (values: SwapFormValues) => {
        setValues(values)
    }

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedAmount(amount);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [amount, 1000]);

    const apiClient = new LayerSwapApiClient()
    const version = LayerSwapApiClient.apiVersion

    const { data: amountRange } = useSWR<ApiResponse<{
        manual_min_amount: number
        manual_min_amount_in_usd: number
        max_amount: number
        max_amount_in_usd: number
        wallet_min_amount: number
        wallet_min_amount_in_usd: number
    }>>((from && fromCurrency && to && toCurrency) ?
        `/routes/limits/${from?.internal_name}/${fromCurrency?.asset}/${to?.internal_name}/${toCurrency?.asset}?version=${version}&refuel=${!!refuel}` : null, apiClient.fetcher, {
        refreshInterval: 10000
    })

    const { data: lsFee, mutate: mutateFee, isLoading: isFeeLoading } = useSWR<ApiResponse<RateResponse>>((from && fromCurrency && to && toCurrency && debouncedAmount) ?
        `/routes/rate/${from?.internal_name}/${fromCurrency?.asset}/${to?.internal_name}/${toCurrency?.asset}?amount=${debouncedAmount}&refuel=${!!refuel}&version=${version}` : null, apiClient.fetcher, {
        refreshInterval: 10000,
        fallbackData: { data: cachedRateData }
    })

    useEffect(() => {
        setCachedRateData(lsFee?.data)
    }, [lsFee])

    const fee = {
        walletFee: lsFee?.data?.wallet_fee,
        manualFee: lsFee?.data?.manual_fee,
        walletReceiveAmount: lsFee?.data?.wallet_receive_amount,
        manualReceiveAmount: lsFee?.data?.manual_receive_amount,
        refuelAmount: lsFee?.data?.refuel_amount,
        avgCompletionTime: lsFee?.data?.avg_completion_time
    }

    return (
        <FeeStateContext.Provider value={{ minAllowedAmount: amountRange?.data?.manual_min_amount, maxAllowedAmount: amountRange?.data?.max_amount, fee, mutateFee, valuesChanger, isFeeLoading }}>
            {children}
        </FeeStateContext.Provider>
    )
}

type RateResponse = {
    avg_completion_time: string,
    manual_fee: number,
    manual_fee_in_usd: number,
    manual_receive_amount: number,
    receive_asset: string,
    receive_network: string,
    refuel_amount: number,
    refuel_amount_in_usd: number,
    refuel_asset: string,
    wallet_fee: number,
    wallet_fee_in_usd: number,
    wallet_receive_amount: number,
}

export function useFee() {
    const data = useContext(FeeStateContext);

    if (data === null) {
        throw new Error('useFee must be used within a FeeProvider');
    }

    return data;
}

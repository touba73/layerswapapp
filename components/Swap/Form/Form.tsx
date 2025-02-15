import { Form, FormikErrors, useFormikContext } from "formik";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import Image from 'next/image';
import SwapButton from "../../buttons/swapButton";
import React from "react";
import NetworkFormField from "../../Input/NetworkFormField";
import LayerSwapApiClient, { AddressBookItem } from "../../../lib/layerSwapApiClient";
import { SwapFormValues } from "../../DTOs/SwapFormValues";
import { Partner } from "../../../Models/Partner";
import Modal from "../../modal/modal";
import { useSwapDataState, useSwapDataUpdate } from "../../../context/swap";
import { isValidAddress } from "../../../lib/addressValidator";
import shortenAddress from "../../utils/ShortenAddress";
import useSWR from "swr";
import { ApiResponse } from "../../../Models/ApiResponse";
import { motion, useCycle } from "framer-motion";
import { ArrowUpDown, Loader2 } from 'lucide-react'
import { useAuthState } from "../../../context/authContext";
import WarningMessage from "../../WarningMessage";
import { GetDefaultAsset } from "../../../helpers/settingsHelper";
import KnownInternalNames from "../../../lib/knownIds";
import { Widget } from "../../Widget/Index";
import { classNames } from "../../utils/classNames";
import GasDetails from "../../gasDetails";
import { useQueryState } from "../../../context/query";
import FeeDetailsComponent from "../../FeeDetails";
import { useFee } from "../../../context/feeContext";
import AmountField from "../../Input/Amount"
import dynamic from "next/dynamic";
import { Balance, Gas } from "../../../Models/Balance";

type Props = {
    isPartnerWallet?: boolean,
    partner?: Partner,
}

const ReserveGasNote = dynamic(() => import("../../ReserveGasNote"), {
    loading: () => <></>,
});

const Address = dynamic(() => import("../../Input/Address"), {
    loading: () => <></>,
});


const SwapForm: FC<Props> = ({ partner, isPartnerWallet }) => {
    const {
        values,
        setValues,
        errors, isValid, isSubmitting, setFieldValue
    } = useFormikContext<SwapFormValues>();

    const { to: destination, fromCurrency, toCurrency, from: source, fromExchange, toExchange } = values
    const { minAllowedAmount, valuesChanger, fee } = useFee()
    const toAsset = values.toCurrency?.asset
    const { authData } = useAuthState()

    const layerswapApiClient = new LayerSwapApiClient()
    const address_book_endpoint = authData?.access_token ? `/swaps/recent_addresses` : null
    const { data: address_book } = useSWR<ApiResponse<AddressBookItem[]>>(address_book_endpoint, layerswapApiClient.fetcher, { dedupingInterval: 60000 })

    const partnerImage = partner?.logo_url
    const { setDepositeAddressIsfromAccount, setAddressConfirmed } = useSwapDataUpdate()
    const { depositeAddressIsfromAccount } = useSwapDataState()
    const query = useQueryState();
    let valuesSwapperDisabled = false;
    const [showAddressModal, setShowAddressModal] = useState(false);
    const lockAddress =
        (values.destination_address && values.to)
        && isValidAddress(values.destination_address, values.to)
        && (((query.lockAddress || query.hideAddress) && (query.appName !== "imxMarketplace"))); //TODO Discuss about this with Babken dzyadzya: (query.appName !== "imxMarketplace" || settings.validSignatureisPresent)

    const actionDisplayName = query?.actionButtonText || "Swap now"

    const handleConfirmToggleChange = (value: boolean) => {
        setFieldValue('refuel', value)
    }
    const depositeAddressIsfromAccountRef = useRef<boolean | null>(depositeAddressIsfromAccount);

    useEffect(() => {
        valuesChanger(values)
    }, [values])

    useEffect(() => {
        depositeAddressIsfromAccountRef.current = depositeAddressIsfromAccount
        return () => { (depositeAddressIsfromAccountRef.current = null); return }
    }, [depositeAddressIsfromAccount])

    useEffect(() => {
        if (!source || !toAsset || !GetDefaultAsset(source, toAsset)?.refuel_amount_in_usd) {
            handleConfirmToggleChange(false)
        }
    }, [toAsset, destination, source])

    useEffect(() => {
        setAddressConfirmed(false)
    }, [source])

    useEffect(() => {
        (async () => {
            (await import("../../Input/Address")).default
        })()
    }, [destination])
    const previouslySelectedDestination = useRef(destination);

    //If destination changed to exchange, remove destination_address
    useEffect(() => {
        if ((previouslySelectedDestination.current &&
            (destination?.internal_name != previouslySelectedDestination.current?.internal_name)
            || destination && !isValidAddress(values.destination_address, destination)) && !lockAddress) {
            setFieldValue("destination_address", '')
            setDepositeAddressIsfromAccount(false)
        }
        previouslySelectedDestination.current = destination
    }, [destination])

    useEffect(() => {
        if (values.refuel && minAllowedAmount && (Number(values.amount) < minAllowedAmount)) {
            setFieldValue('amount', minAllowedAmount)
        }
    }, [values.refuel, destination, minAllowedAmount])

    const valuesSwapper = useCallback(() => {
        setValues({ ...values, from: values.to, to: values.from, fromCurrency: values.toCurrency, toCurrency: values.fromCurrency, toExchange: values.fromExchange, fromExchange: values.toExchange }, true)
    }, [values])

    const [animate, cycle] = useCycle(
        { rotate: 0 },
        { rotate: 180 }
    );
    //TODO always map to toAsset from query
    const lockedCurrency = query?.lockAsset ? values.to?.assets?.find(c => c?.asset?.toUpperCase() === toAsset?.toUpperCase()) : null;
    const apiVersion = LayerSwapApiClient.apiVersion
    const sourceRoutesEndpoint = `/routes/sources?destination_network=${source?.internal_name}&destination_asset=${fromCurrency?.asset}${apiVersion ? '&version=' : ''}${apiVersion}`
    const destinationRoutesEndpoint = `/routes/destinations?source_network=${destination?.internal_name}&source_asset=${toCurrency?.asset}${apiVersion ? '&version=' : ''}${apiVersion}`
    const { data: sourceRoutes, isLoading: sourceLoading } = useSWR<ApiResponse<{
        network: string,
        asset: string
    }[]>>((source && fromCurrency) ?
        sourceRoutesEndpoint : `/routes/sources?${apiVersion ? 'version=' : ''}${apiVersion}`, layerswapApiClient.fetcher)

    const { data: destinationRoutes, isLoading: destinationLoading } = useSWR<ApiResponse<{
        network: string,
        asset: string
    }[]>>((destination && toCurrency) ?
        destinationRoutesEndpoint : `/routes/destinations?${apiVersion ? 'version=' : ''}${apiVersion}`, layerswapApiClient.fetcher)

    const sourceCanBeSwapped = destinationRoutes?.data?.some(l => l.network === source?.internal_name)
    const destinationCanBeSwapped = sourceRoutes?.data?.some(l => l.network === destination?.internal_name)

    if (query.lockTo || query.lockFrom || query.hideTo || query.hideFrom) {
        valuesSwapperDisabled = true;
    }
    if (!(sourceCanBeSwapped || destinationCanBeSwapped)) {
        valuesSwapperDisabled = true;
    }
    const a = fee.avgCompletionTime?.split(':');
    const seconds = a && (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
    const averageTimeInMinutes = seconds && (seconds / 60) || 0

    const hideAddress = query?.hideAddress
        && query?.to
        && query?.destAddress
        && (query?.lockTo || query?.hideTo)
        && isValidAddress(query?.destAddress as string, destination)

    const handleReserveGas = useCallback((walletBalance: Balance, networkGas: Gas) => {
        if (walletBalance && networkGas)
            setFieldValue('amount', walletBalance?.amount - networkGas?.gas)
    }, [values.amount])

    return <>
        <Widget className="sm:min-h-[504px]">
            <Form className={`h-full ${(isSubmitting) ? 'pointer-events-none' : 'pointer-events-auto'}`} >
                <Widget.Content>
                    <div className='flex-col relative flex justify-between w-full space-y-0.5 mb-3.5 leading-4'>
                        {!(query?.hideFrom && values?.from) && <div className="flex flex-col w-full">
                            <NetworkFormField direction="from" label="From" className="rounded-t-lg pb-5" />
                        </div>}
                        {!query?.hideFrom && !query?.hideTo &&
                            <button
                                type="button"
                                aria-label="Reverse the source and destination"
                                disabled={valuesSwapperDisabled || sourceLoading || destinationLoading}
                                onClick={valuesSwapper}
                                className={`${sourceLoading || destinationLoading ? "" : "hover:text-primary"} absolute right-[calc(50%-16px)] top-[86px] z-10 border-2 border-secondary-900 bg-secondary-900 rounded-full disabled:cursor-not-allowed disabled:text-secondary-text duration-200 transition disabled:pointer-events-none`}>
                                <motion.div
                                    animate={animate}
                                    transition={{ duration: 0.3 }}
                                    onTap={() => !valuesSwapperDisabled && cycle()}
                                >
                                    {sourceLoading || destinationLoading ?
                                        <Loader2 className="opacity-50 w-7 h-auto p-1 bg-secondary-900 border-2 border-secondary-500 rounded-full disabled:opacity-30 animate-spin" />
                                        :
                                        <ArrowUpDown className={classNames(valuesSwapperDisabled && 'opacity-50', "w-7 h-auto p-1 bg-secondary-900 border-2 border-secondary-500 rounded-full disabled:opacity-30")} />
                                    }
                                </motion.div>
                            </button>}
                        {!(query?.hideTo && values?.to) && <div className="flex flex-col w-full">
                            <NetworkFormField direction="to" label="To" className="rounded-b-lg" />
                        </div>}
                    </div>
                    <div className="mb-6 leading-4">
                        <AmountField />
                    </div>
                    {
                        !hideAddress ?
                            <div className="w-full mb-3.5 leading-4">
                                <label htmlFor="destination_address" className="block font-semibold text-secondary-text text-xs">
                                    {`To ${values?.to?.display_name || ''} address`}
                                </label>
                                <AddressButton
                                    disabled={!values.to || !values.from}
                                    isPartnerWallet={!!isPartnerWallet}
                                    openAddressModal={() => setShowAddressModal(true)}
                                    partnerImage={partnerImage}
                                    values={values} />
                                <Modal
                                    header={`To ${values?.to?.display_name || ''} address`}
                                    height="fit"
                                    show={showAddressModal} setShow={setShowAddressModal}
                                    className="min-h-[70%]"
                                    modalId="address"
                                >
                                    <Address
                                        close={() => setShowAddressModal(false)}
                                        disabled={lockAddress || (!values.to || !values.from)}
                                        name={"destination_address"}
                                        partnerImage={partnerImage}
                                        isPartnerWallet={!!isPartnerWallet}
                                        partner={partner}
                                        address_book={address_book?.data}
                                    />
                                </Modal>
                            </div>
                            : <></>
                    }
                    <div className="w-full">
                        <FeeDetailsComponent values={values} />
                        {
                            //TODO refactor 
                            destination && toAsset && destination?.internal_name === KnownInternalNames.Networks.StarkNetMainnet && averageTimeInMinutes > 30 &&
                            <WarningMessage messageType="warning" className="mt-4">
                                <span className="font-normal"><span>{destination?.display_name}</span> <span>network congestion. Transactions can take up to 1 hour.</span></span>
                            </WarningMessage>
                        }
                        {
                            values.amount &&
                            <ReserveGasNote onSubmit={(walletBalance, networkGas) => handleReserveGas(walletBalance, networkGas)} />
                        }
                    </div>
                </Widget.Content>
                <Widget.Footer>
                    <SwapButton
                        className="plausible-event-name=Swap+initiated"
                        type='submit'
                        isDisabled={!isValid}
                        isSubmitting={isSubmitting}>
                        {ActionText(errors, actionDisplayName)}
                    </SwapButton>
                </Widget.Footer>
            </Form>
        </Widget>
        {
            process.env.NEXT_PUBLIC_SHOW_GAS_DETAILS === 'true'
            && values.from
            && values.fromCurrency &&
            <GasDetails network={values.from} currency={values.fromCurrency} />
        }
    </>
}

function ActionText(errors: FormikErrors<SwapFormValues>, actionDisplayName: string): string {
    return errors.from?.toString()
        || errors.to?.toString()
        || errors.amount
        || errors.destination_address
        || (actionDisplayName)
}

const TruncatedAdrress = ({ address }: { address: string }) => {
    const shortAddress = shortenAddress(address)
    return <div className="tracking-wider text-primary-text">{shortAddress}</div>
}

type AddressButtonProps = {
    openAddressModal: () => void;
    isPartnerWallet: boolean;
    values: SwapFormValues;
    partnerImage?: string;
    disabled: boolean;
}
const AddressButton: FC<AddressButtonProps> = ({ openAddressModal, isPartnerWallet, values, partnerImage, disabled }) => {
    const destination = values?.to
    return <button type="button" disabled={disabled} onClick={openAddressModal} className="flex rounded-lg space-x-3 items-center cursor-pointer shadow-sm mt-1.5 text-primary-text-placeholder bg-secondary-700 border-secondary-500 border disabled:cursor-not-allowed h-12 leading-4 focus:ring-primary focus:border-primary font-semibold w-full px-3.5 py-3">
        {isPartnerWallet &&
            <div className="shrink-0 flex items-center pointer-events-none">
                {
                    partnerImage &&
                    <Image
                        alt="Partner logo"
                        className='rounded-md object-contain'
                        src={partnerImage}
                        width="24"
                        height="24"></Image>
                }
            </div>
        }
        <div className="truncate">
            {values.destination_address ?
                <TruncatedAdrress address={values.destination_address} />
                :
                <span>Enter your address here</span>
            }
        </div>
    </button>
}




export default SwapForm

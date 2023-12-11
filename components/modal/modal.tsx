import { AnimatePresence } from "framer-motion";
import React, { Dispatch, ReactNode, SetStateAction, useEffect, useRef } from "react";
import { FC } from "react"
import useWindowDimensions from "../../hooks/useWindowDimensions";
import { Leaflet, LeafletHeight } from "./leaflet";
import ReactPortal from "../Common/ReactPortal";
import { useComponentsConfigs } from "../../stores/componentsConfigs";

export interface ModalProps {
    header?: ReactNode;
    subHeader?: string | JSX.Element
    children?: JSX.Element | JSX.Element[];
    className?: string;
    height?: LeafletHeight;
    show: boolean;
    setShow: Dispatch<SetStateAction<boolean>>;
}

const Modal: FC<ModalProps> = (({ header, height, className, children, subHeader, show, setShow }) => {
    const { isMobile, isDesktop } = useWindowDimensions()
    const mobileModalRef = useRef(null)
    const { setIsModalOpen } = useComponentsConfigs()

    useEffect(() => {
        if (isMobile && show) {
            window.document.body.style.overflow = 'hidden'
            setIsModalOpen(true)
        } else {
            setIsModalOpen(false)
        }
        return () => { window.document.body.style.overflow = '' }
    }, [isMobile, show])

    return (
        <>
            <AnimatePresence>
                {show && (
                    <>
                        {isDesktop &&
                            <ReactPortal wrapperId={"widget_root"}>
                                <Leaflet position="absolute" height={height ?? 'full'} ref={mobileModalRef} show={show} setShow={setShow} title={header} description={subHeader} className={className}>
                                    {children}
                                </Leaflet>
                            </ReactPortal>
                        }
                        {
                            isMobile &&
                            <Leaflet position="fixed" height={height == 'full' ? '80%' : height == 'fit' ? 'fit' : 'full'} ref={mobileModalRef} show={show} setShow={setShow} title={header} description={subHeader} className={className}>
                                {children}
                            </Leaflet>
                        }
                    </>
                )}
            </AnimatePresence>
        </>
    )
})

export default Modal;
import { FC, useEffect, useRef } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/solid';
import { useFormWizardaUpdate, useFormWizardState } from '../../context/formWizardProvider';
import LayerswapMenu from '../LayerswapMenu';
import GoHomeButton from '../utils/GoHome';
import { AnimatePresence, motion } from 'framer-motion';

type Props = {
   children: JSX.Element | JSX.Element[];
}

const Wizard: FC<Props> = ({ children }) => {

   const wrapper = useRef(null);

   const { wrapperWidth, loading: loadingWizard, positionPercent, moving } = useFormWizardState()
   const { setWrapperWidth } = useFormWizardaUpdate()
   const loading = loadingWizard

   useEffect(() => {
      function handleResize() {
         if (wrapper.current !== null) {
            setWrapperWidth(wrapper.current.offsetWidth);
         }
      }
      window.addEventListener("resize", handleResize);
      handleResize();

      return () => window.removeEventListener("resize", handleResize);
   }, []);

   const width = positionPercent || 0
   return <>
      <div className={`pb-6 bg-darkblue shadow-card immutablex:shadow-none rounded-lg w-full overflow-hidden relative`}>
         <div className="relative">
            <div className="overflow-hidden h-1 flex rounded-t-lg bg-darkblue-500">
               <div style={{ width: `${width}%`, transition: 'width 1s' }} className="shadow-none flex flex-col whitespace-nowrap justify-center bg-primary"></div>
            </div>
         </div>
         <WizardHeader wrapperWidth={wrapperWidth} />
         <div className='text-center text-xl text-darkblue-50'>

         </div>
         <div className="relative px-6 md:px-8">
            <div className="flex items-start"
               ref={wrapper}>
               <AnimatePresence initial={false} custom={{ direction: moving === "forward" ? 1 : -1, width: wrapperWidth }}>
                  <div className={`flex flex-nowrap`}>
                     {children}
                  </div>
               </AnimatePresence>
            </div>
         </div>
      </div>
   </>
}

function WizardHeader({ wrapperWidth }: { wrapperWidth: number }) {
   const { goBack } = useFormWizardState()

   return (
      <div className="w-full flex items-center justify-between px-6 md:px-8 mt-3" >
         {
            goBack ?
               <button onClick={goBack} className="justify-self-start" style={{ visibility: false ? 'hidden' : 'visible' }}>
                  <ArrowLeftIcon className='h-5 w-5 text-primary-text hover:text-darkblue-500 cursor-pointer' />
               </button>
               :
               <div className='h-7 w-7'></div>
         }
         <div className='mx-auto px-4 overflow-hidden immutablex:hidden md:hidden'>
            <div className="flex justify-center">
               <GoHomeButton />
            </div>
         </div>
         <LayerswapMenu />
      </div>
   )
}

export default Wizard;
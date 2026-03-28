import { useState } from 'react'
import { FormBuilder } from '@/shared/components/FormBuilder'
import { Layout } from '@/shared/components/Layout'
import { Modal } from '@/shared/components/Modal'
import { useAppDispatch } from '@/shared/hooks/reduxHooks'
import { createContractThunk } from '../store'

export function CreateContractPage() {
  const dispatch = useAppDispatch()
  const [isModalOpen, setModalOpen] = useState(false)

  return (
    <Layout
      title="Create Contract"
      description="Create and store employee contract details."
    >
      <FormBuilder
        fields={[
          { name: 'employeeName', label: 'Employee', type: 'text', required: true },
          { name: 'contractType', label: 'Contract Type', type: 'text', required: true },
          { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        ]}
        submitLabel="Create Contract"
        onSubmit={async (values) => {
          await dispatch(
            createContractThunk({
              employeeName: values.employeeName,
              contractType: values.contractType,
              startDate: values.startDate,
            }),
          )
          setModalOpen(true)
        }}
      />

      <Modal open={isModalOpen} title="Contract Created" onClose={() => setModalOpen(false)}>
        <p className="text-sm text-slate-700">Contract record was created successfully.</p>
      </Modal>
    </Layout>
  )
}

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { createId } from '@/shared/utils/id'
import { createContractApi } from './api'

const initialState = { items: [] }

export const createContractThunk = createAsyncThunk(
  'contracts/create',
  async (payload) => createContractApi({ ...payload, id: createId() }),
)

const contractsSlice = createSlice({
  name: 'contracts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(createContractThunk.fulfilled, (state, action) => {
      state.items.unshift(action.payload)
    })
  },
})

export const contractsReducer = contractsSlice.reducer

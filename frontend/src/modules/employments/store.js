import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { assignEmploymentApi, getEmployeeAssignmentsApi, unassignEmploymentApi } from './api'

const initialState = { 
  assignments: [],
  selectedAssignments: [],
  isLoading: false, 
  error: null 
}

export const assignEmploymentThunk = createAsyncThunk(
  'employments/assign',
  async (payload, { rejectWithValue }) => {
    try {
      return await assignEmploymentApi(payload);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to assign employment');
    }
  },
)

export const fetchEmployeeAssignmentsThunk = createAsyncThunk(
  'employments/fetchAssignments',
  async (employeeId, { rejectWithValue }) => {
    try {
      return await getEmployeeAssignmentsApi(employeeId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch assignments');
    }
  },
)

export const unassignEmploymentThunk = createAsyncThunk(
  'employments/unassign',
  async ({ employeeId, departmentId }, { rejectWithValue }) => {
    try {
      return await unassignEmploymentApi(employeeId, departmentId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to unassign employment');
    }
  },
)

const employmentsSlice = createSlice({
  name: 'employments',
  initialState,
  reducers: {
    clearSelectedAssignments: (state) => {
      state.selectedAssignments = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(assignEmploymentThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(assignEmploymentThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.assignments.unshift(action.payload);
      })
      .addCase(assignEmploymentThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchEmployeeAssignmentsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeAssignmentsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedAssignments = action.payload;
      })
      .addCase(fetchEmployeeAssignmentsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(unassignEmploymentThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(unassignEmploymentThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedAssignments = state.selectedAssignments.filter(
          a => a.departmentId !== action.payload.departmentId
        );
      })
      .addCase(unassignEmploymentThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
  },
})

export const { clearSelectedAssignments } = employmentsSlice.actions;
export const employmentsReducer = employmentsSlice.reducer

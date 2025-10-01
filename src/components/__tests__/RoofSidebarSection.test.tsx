import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BuildingProvider, useBuildingState, type BuildingStateValue } from '../../context/BuildingProvider';
import { RoofSidebarSection } from '../sidebar/RoofSidebarSection';

const contextRef: { current: BuildingStateValue | null } = { current: null };

const StateProbe: React.FC = () => {
  const ctx = useBuildingState();
  contextRef.current = ctx;
  const activeFloor = ctx.state.floors.find((floor) => floor.id === ctx.state.activeFloorId)!;
  return (
    <div>
      <div data-testid="roof-type">{activeFloor.roof.type}</div>
      <div data-testid="roof-slope">{activeFloor.roof.slopeValue}</div>
      <div data-testid="ridge-height">{activeFloor.roof.ridgeHeight}</div>
      <div data-testid="parapet-height">{activeFloor.roof.parapetHeight}</div>
      <div data-testid="eave-offset">{activeFloor.dimensions[2]?.offset}</div>
      <div data-testid="dimension-toggle">{ctx.state.modes.dimensionVisibleElevation ? 'on' : 'off'}</div>
    </div>
  );
};

const renderComponent = () =>
  render(
    <BuildingProvider initialTemplate="rectangle">
      <RoofSidebarSection />
      <StateProbe />
    </BuildingProvider>
  );

describe('RoofSidebarSection', () => {
  beforeEach(() => {
    contextRef.current = null;
    window.localStorage.clear();
  });

  it('allows selecting a roof type and updates provider state', () => {
    renderComponent();

    const gableButton = screen.getByRole('button', { name: /切妻/i });
    fireEvent.click(gableButton);

    expect(screen.getByTestId('roof-type').textContent).toBe('gable');
  });

  it('updates parapet height for flat roofs', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /フラット/ }));
    const parapetInput = screen.getByLabelText(/立ち上がり/);
    fireEvent.change(parapetInput, { target: { value: '450' } });
    fireEvent.blur(parapetInput);
    expect(screen.getByTestId('parapet-height').textContent).toBe('450');
  });

  it('updates slope and ridge height values when roof is not flat', () => {
    renderComponent();

    const gableButton = screen.getByRole('button', { name: /切妻/i });
    fireEvent.click(gableButton);

    const slopeInput = screen.getByLabelText(/勾配/);
    fireEvent.change(slopeInput, { target: { value: '4' } });
    fireEvent.blur(slopeInput);
    expect(screen.getByTestId('roof-slope').textContent).toBe('4');

    const ridgeInput = screen.getByLabelText(/最高高さ/);
    fireEvent.change(ridgeInput, { target: { value: '3800' } });
    fireEvent.blur(ridgeInput);
    expect(screen.getByTestId('ridge-height').textContent).toBe('3800');
  });

  it('applies eave offsets uniformly', () => {
    renderComponent();
    const offsetInput = screen.getByLabelText(/軒の出/);
    fireEvent.change(offsetInput, { target: { value: '650' } });
    fireEvent.blur(offsetInput);

    expect(screen.getByTestId('eave-offset').textContent).toBe('650');
  });

  it('shows validation errors for invalid input values', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /フラット/ }));
    const parapetInput = screen.getByLabelText(/立ち上がり/);
    fireEvent.change(parapetInput, { target: { value: '-20' } });
    fireEvent.blur(parapetInput);
    expect(screen.getByText(/立ち上がりは0以上/)).toBeInTheDocument();

    const gableButton = screen.getByRole('button', { name: /切妻/i });
    fireEvent.click(gableButton);

    const slopeInput = screen.getByLabelText(/勾配/);
    fireEvent.change(slopeInput, { target: { value: '-1' } });
    fireEvent.blur(slopeInput);
    expect(screen.getByText(/勾配は0以上/)).toBeInTheDocument();

    const ridgeInput = screen.getByLabelText(/最高高さ/);
    fireEvent.change(ridgeInput, { target: { value: '100' } });
    fireEvent.blur(ridgeInput);
    expect(screen.getByText(/最高高さは階高以上/)).toBeInTheDocument();

    const eaveInput = screen.getByLabelText(/軒の出/);
    fireEvent.change(eaveInput, { target: { value: '-20' } });
    fireEvent.blur(eaveInput);
    expect(screen.getByText(/軒の出は0以上/)).toBeInTheDocument();
  });

  it('toggles elevation dimension visibility', () => {
    renderComponent();

    const toggleButton = screen.getByRole('button', { name: '立面寸法表示' });
    expect(screen.getByTestId('dimension-toggle').textContent).toBe('on');
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('dimension-toggle').textContent).toBe('off');
  });

  it('disables controls when the active floor is locked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /フラット/ }));
    const ctx = contextRef.current;
    expect(ctx).not.toBeNull();

    act(() => {
      ctx!.dispatch({ type: 'toggleFloorLock', floorId: ctx!.state.activeFloorId, locked: true });
    });

    const parapetInput = screen.getByLabelText(/立ち上がり/);
    expect(parapetInput).toBeDisabled();
    const eaveInput = screen.getByLabelText(/軒の出/);
    expect(eaveInput).toBeDisabled();
    const gableButton = screen.getByRole('button', { name: /切妻/i });
    expect(gableButton).toHaveAttribute('aria-disabled', 'true');
  });
});

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildingProvider } from '../../context/BuildingProvider';
import { PlanViewCanvas } from '../PlanViewCanvas';
import { DimensionPanel } from '../DimensionPanel';
import { ElevationViews } from '../ElevationViews';
import { ThreeDView } from '../ThreeDView';
import { OutputToolbar } from '../OutputToolbar';

type KonvaEvent = { target: { x: () => number; y: () => number } };

jest.mock('react-konva', () => {
  const React = require('react');
  return {
    Stage: ({ children, width, height, ...props }: any) => (
      <div data-testid="plan-stage" data-width={width} data-height={height} {...props}>
        {children}
      </div>
    ),
    Layer: ({ children, ...props }: any) => (
      <div data-testid="plan-layer" {...props}>
        {children}
      </div>
    ),
    Line: ({ points, stroke, dash, closed: _closed, listening: _listening, lineCap: _lineCap, lineJoin: _lineJoin, ...props }: any) => (
      <div
        data-testid="plan-floor-line"
        data-points={points.join(',')}
        data-stroke={stroke}
        data-dash={dash ? dash.join(',') : ''}
        {...props}
      />
    ),
    Circle: ({ onDragEnd, x, y, ...props }: any) => (
      <button
        type="button"
        data-testid={props['data-testid']}
        onClick={() =>
          onDragEnd?.({
            target: {
              x: () => (x ?? 0) + 20,
              y: () => (y ?? 0) + 10
            }
          } as KonvaEvent)
        }
        {...props}
      >
        vertex
      </button>
    ),
    Text: ({ text, ...props }: any) => (
      <span data-testid="plan-text" {...props}>
        {text}
      </span>
    )
  };
});

jest.mock('@react-three/fiber', () => {
  const React = require('react');
  return {
    Canvas: ({ children, ...props }: any) => (
      <div data-testid="three-canvas" {...props}>
        {children}
      </div>
    ),
    ambientLight: (props: any) => <span data-testid="ambient-light" {...props} />
  };
});

jest.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  PerspectiveCamera: ({ children }: any) => <>{children}</>,
  Line: (props: any) => <div data-testid="three-line" data-points={JSON.stringify(props.points)} />
}));

const addImageMock = jest.fn();
const saveMock = jest.fn();

jest.mock('html-to-image', () => ({
  toSvg: jest.fn().mockResolvedValue('<svg></svg>'),
  toJpeg: jest.fn().mockResolvedValue('data:image/jpeg;base64,AAA')
}));

jest.mock('jspdf', () => ({
  jsPDF: function MockJsPDF() {
    return {
      addImage: addImageMock,
      save: saveMock
    };
  }
}));

describe('Editor views integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  const renderEditor = () =>
    render(
      <BuildingProvider initialTemplate="rectangle">
      <div>
        <PlanViewCanvas />
        <DimensionPanel />
        <ElevationViews />
        <ThreeDView />
        <OutputToolbar />
      </div>
    </BuildingProvider>
  );

  it('syncs plan, dimension, elevation, and 3D data when updating dimensions', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getAllByTestId('plan-floor-line')).toHaveLength(1);
    const north = screen.getByTestId('elevation-north');
    expect(north).toHaveTextContent('|──6000──|');

    const lengthInput = screen.getByLabelText('Edge 1 Length (mm)');
    await user.clear(lengthInput);
    await user.type(lengthInput, '7000');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('elevation-north')).toHaveTextContent('|──7000──|');
    });

    const threeSummary = screen.getByTestId('three-summary');
    expect(threeSummary).toHaveTextContent('floor-1');
    expect(threeSummary).toHaveTextContent('height: 3000mm');
  });

  it('updates plan data when a vertex is dragged', async () => {
    const user = userEvent.setup();
    renderEditor();

    const line = screen.getByTestId('plan-floor-line');
    const beforePoints = line.getAttribute('data-points');
    const vertexButton = screen.getByTestId('plan-vertex-0');
    await user.click(vertexButton);

    await waitFor(() => {
      const afterPoints = screen.getByTestId('plan-floor-line').getAttribute('data-points');
      expect(afterPoints).not.toBe(beforePoints);
    });
  });

  it('shows validation errors for invalid floor height input', async () => {
    const user = userEvent.setup();
    renderEditor();

    const heightInput = screen.getByLabelText('Floor Height (mm)');
    await user.clear(heightInput);
    await user.type(heightInput, '-100');
    await user.tab();

    const alerts = screen.getAllByRole('alert');
    const inlineAlert = alerts.find((node) => within(node).queryByText(/0より大きい/));
    expect(inlineAlert).toBeTruthy();
    expect(screen.getByTestId('elevation-north')).toHaveTextContent('|──6000──|');
  });

  it('provides export feedback in the output toolbar', async () => {
    const user = userEvent.setup();
    renderEditor();

    const svgButton = screen.getByText('Export SVG');
    await user.click(svgButton);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('SVGをエクスポートしました。');
    });
  });
});

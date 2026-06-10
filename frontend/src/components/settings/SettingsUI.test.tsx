import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Field, SaveIcon, ConfigSection, TagInput } from './SettingsUI';

afterEach(cleanup);

describe('Field', () => {
  it('renders its label and children', () => {
    render(<Field label="Téléphone"><input aria-label="phone" /></Field>);
    expect(screen.getByText('Téléphone')).toBeInTheDocument();
    expect(screen.getByLabelText('phone')).toBeInTheDocument();
  });
});

describe('SaveIcon', () => {
  it.each([
    ['idle', 'Sauvegarder'],
    ['saving', 'Sauvegarde'],
    ['saved', 'Sauvegardé'],
    ['error', 'Erreur'],
  ] as const)('shows the right label for status=%s', (status, label) => {
    const { container } = render(<SaveIcon status={status} />);
    expect(container.textContent).toContain(label);
  });
});

describe('ConfigSection', () => {
  it('renders title + children and fires onSave', () => {
    const onSave = vi.fn();
    render(
      <ConfigSection icon={<span />} title="Bot config" saveStatus="idle" onSave={onSave}>
        <p>inner content</p>
      </ConfigSection>,
    );
    expect(screen.getByRole('heading', { name: 'Bot config' })).toBeInTheDocument();
    expect(screen.getByText('inner content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables the save button while saving', () => {
    render(
      <ConfigSection icon={<span />} title="X" saveStatus="saving" onSave={() => {}}>
        <p />
      </ConfigSection>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('TagInput', () => {
  const baseProps = {
    tags: ['paris', 'lyon'],
    inputValue: '',
    onInputChange: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    placeholder: 'Ajouter une ville',
    icon: <span />,
  };

  it('renders existing tags', () => {
    render(<TagInput {...baseProps} />);
    expect(screen.getByText('paris')).toBeInTheDocument();
    expect(screen.getByText('lyon')).toBeInTheDocument();
  });

  it('calls onAdd when the Ajouter button is clicked', () => {
    const onAdd = vi.fn();
    render(<TagInput {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onAdd when Enter is pressed in the input', () => {
    const onAdd = vi.fn();
    render(<TagInput {...baseProps} onAdd={onAdd} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Ajouter une ville'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the tag when its × is clicked', () => {
    const onRemove = vi.fn();
    render(<TagInput {...baseProps} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer paris' }));
    expect(onRemove).toHaveBeenCalledWith('paris');
  });
});

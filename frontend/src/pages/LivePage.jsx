import CesiumViewer from '../components/CesiumViewer';

export default function LivePage() {
    return (
        <CesiumViewer
            style={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}
        />
    );
}

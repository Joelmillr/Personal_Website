/**
 * Diagnostic utilities for debugging data loading issues
 */

function createDiagnostics(processor, pathData, attitudeData) {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        processor: {
            dataCount: processor ? processor.getDataCount() : 0,
            hasData: processor && processor.getDataCount() > 0
        },
        pathData: {
            latsCount: pathData?.lats?.length || 0,
            lonsCount: pathData?.lons?.length || 0,
            altsCount: pathData?.alts?.length || 0,
            sampleLat: pathData?.lats?.[0],
            sampleLon: pathData?.lons?.[0],
            sampleAlt: pathData?.alts?.[0],
            hasData: pathData && pathData.lats && pathData.lats.length > 0
        },
        attitudeData: {
            yawsCount: attitudeData?.yaws?.length || 0,
            pitchesCount: attitudeData?.pitches?.length || 0,
            rollsCount: attitudeData?.rolls?.length || 0,
            sampleYaw: attitudeData?.yaws?.[0],
            samplePitch: attitudeData?.pitches?.[0],
            sampleRoll: attitudeData?.rolls?.[0],
            hasData: attitudeData && attitudeData.yaws && attitudeData.yaws.length > 0
        },
        individualData: null
    };

    // Test individual data access
    if (processor && processor.getDataCount() > 0) {
        try {
            const testData = processor.getDataAtIndex(0);
            diagnostics.individualData = {
                hasData: !!testData,
                VLAT: testData?.VLAT,
                VLON: testData?.VLON,
                VALT: testData?.VALT,
                VQX: testData?.VQX,
                VQY: testData?.VQY,
                VQZ: testData?.VQZ,
                VQW: testData?.VQW
            };
        } catch (error) {
            diagnostics.individualData = { error: error.message };
        }
    }

    return diagnostics;
}

module.exports = { createDiagnostics };



